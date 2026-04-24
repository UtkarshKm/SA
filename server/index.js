import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import multer from "multer";
import { CATEGORY_ASPECTS, resolveCategory } from "./lib/aspects.js";
import { authHandler } from "./lib/auth.js";
import { requireSession } from "./lib/authSession.js";
import { parseCsvBuffer, stringifyRows } from "./lib/csv.js";
import { connectDatabase } from "./lib/db.js";
import {
  createQueuedRun,
  getRunByIdForUser,
  getRunMetadataByIdForUser,
  listRunsByUser,
  markActiveRunsInterrupted,
  requestRunCancel
} from "./lib/runRepository.js";
import { enqueueRunProcessing } from "./lib/runProcessor.js";
import { SentimentAnalyzer } from "./lib/sentiment.js";
import { detectTextColumn } from "./lib/text.js";

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "almost",
  "also",
  "among",
  "and",
  "another",
  "any",
  "are",
  "around",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "came",
  "can",
  "could",
  "did",
  "does",
  "doing",
  "done",
  "down",
  "each",
  "even",
  "every",
  "few",
  "find",
  "first",
  "fit",
  "for",
  "from",
  "get",
  "got",
  "had",
  "has",
  "have",
  "having",
  "her",
  "here",
  "hers",
  "him",
  "his",
  "how",
  "into",
  "its",
  "just",
  "like",
  "look",
  "made",
  "make",
  "many",
  "more",
  "most",
  "much",
  "need",
  "not",
  "now",
  "off",
  "often",
  "one",
  "only",
  "onto",
  "other",
  "our",
  "out",
  "over",
  "really",
  "same",
  "she",
  "should",
  "some",
  "still",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "too",
  "under",
  "very",
  "was",
  "way",
  "wear",
  "well",
  "were",
  "what",
  "when",
  "which",
  "while",
  "with",
  "would",
  "your"
]);

const DOMAIN_STOPWORDS = new Set([
  "amazon",
  "customer",
  "customers",
  "delivery",
  "item",
  "items",
  "order",
  "ordered",
  "purchase",
  "purchased",
  "report",
  "received",
  "refund",
  "seller",
  "sellers",
  "verified"
]);

const NEGATION_WORDS = new Set(["not", "never", "no", "hardly", "barely", "without", "isnt", "wasnt", "dont", "didnt", "cant", "couldnt", "wont"]);
const MAX_DOCUMENT_FREQUENCY_RATIO = 0.6;
const CATEGORY_NOISE_TERMS = {
  CLOTHING: new Set(["product", "products", "shoe", "shoes"])
};

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const analyzer = new SentimentAnalyzer();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors({ origin: true, credentials: true }));
app.use((request, _response, next) => {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.path}`);
  next();
});

app.all("/api/auth/*", authHandler);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "sentiment-analysis-api",
    timestamp: new Date().toISOString()
  });
});

function paginateRows(rows, { page = 1, pageSize = 20, search = "", sentiment = "ALL" }) {
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const matchesSentiment = sentiment === "ALL" ? true : row.predicted_label === sentiment;
    const matchesSearch =
      normalizedSearch === ""
        ? true
        : row.clean_text.includes(normalizedSearch) ||
          row.original_text.toLowerCase().includes(normalizedSearch) ||
          row.aspects.join(" ").toLowerCase().includes(normalizedSearch);

    return matchesSentiment && matchesSearch;
  });

  const start = (page - 1) * pageSize;

  return {
    total: filtered.length,
    page,
    pageSize,
    rows: filtered.slice(start, start + pageSize)
  };
}

function buildExportRows(rows) {
  return rows.map((row) => ({
    ...row.sourceRow,
    original_text: row.original_text,
    clean_text: row.clean_text,
    predicted_label: row.predicted_label,
    confidence: row.confidence,
    aspects: row.aspects.join(", "),
    aspect_count: row.aspect_count
  }));
}

function tokenize(text) {
  return String(text || "")
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(
      (token) =>
        (token.length >= 3 || NEGATION_WORDS.has(token)) &&
        /^[a-z][a-z0-9]*$/i.test(token) &&
        (!STOPWORDS.has(token) || NEGATION_WORDS.has(token)) &&
        !DOMAIN_STOPWORDS.has(token)
    );
}

function extractTerms(tokens) {
  const terms = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    terms.push(token);

    const nextToken = tokens[index + 1];
    if (!nextToken) {
      continue;
    }

    if (NEGATION_WORDS.has(token)) {
      terms.push(`${token}_${nextToken}`);
      continue;
    }

    if (!NEGATION_WORDS.has(nextToken)) {
      terms.push(`${token}_${nextToken}`);
    }
  }

  return terms;
}

function buildTokenList(counter, limit = 12) {
  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([token, count]) => ({ token, count }));
}

function buildWordCloudList(counter, limit = 36) {
  const entries = [...counter.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit);
  const max = entries[0]?.[1] || 1;

  return entries.map(([text, value]) => ({
    text,
    value,
    weight: Number((value / max).toFixed(3))
  }));
}

function isAllowedCloudTerm(term, category) {
  const categoryNoise = CATEGORY_NOISE_TERMS[category] || new Set();
  const parts = term.split("_");

  if (parts.length === 1) {
    return !categoryNoise.has(term);
  }

  return !parts.every((part) => categoryNoise.has(part));
}

function buildDistinctiveWordCloud(counter, tokenCounters, tokenTotals, sentiment, allowedTerms, limit = 36) {
  const targetTotal = tokenTotals[sentiment] || 0;

  if (targetTotal === 0) {
    return [];
  }

  const otherSentiments = ["POSITIVE", "NEUTRAL", "NEGATIVE"].filter((item) => item !== sentiment);
  const otherTotal = otherSentiments.reduce((sum, item) => sum + (tokenTotals[item] || 0), 0);

  const ranked = [...counter.entries()]
    .filter(([text]) => allowedTerms.has(text))
    .map(([text, count]) => {
      const targetRate = count / targetTotal;
      const competingCount = otherSentiments.reduce((sum, item) => sum + (tokenCounters[item].get(text) || 0), 0);
      const competingRate = otherTotal === 0 ? 0 : competingCount / otherTotal;
      const score = Math.max(0, targetRate - competingRate) * Math.log2(count + 1);

      return {
        text,
        count,
        score
      };
    })
    .filter((item) => item.count >= 2 && item.score > 0)
    .sort((left, right) => right.score - left.score || right.count - left.count || left.text.localeCompare(right.text))
    .slice(0, limit);

  if (ranked.length === 0) {
    return buildWordCloudList(new Map([...counter.entries()].filter(([text]) => allowedTerms.has(text))), limit);
  }

  const maxScore = ranked[0]?.score || 1;

  return ranked.map((item) => ({
    text: item.text,
    value: item.count,
    weight: Number((item.score / maxScore).toFixed(3))
  }));
}

function selectWordCloudTerms(documentFrequency, totalReviews, category) {
  return new Set(
    [...documentFrequency.entries()]
      .filter(
        ([term, count]) =>
          count >= 2 &&
          count / Math.max(totalReviews, 1) <= MAX_DOCUMENT_FREQUENCY_RATIO &&
          isAllowedCloudTerm(term, category)
      )
      .map(([term]) => term)
  );
}

function buildVisualizations(rows, category) {
  const aspectSentimentMap = new Map();
  const coverage = { withAspects: 0, withoutAspects: 0 };
  const lengthStatsMap = new Map([
    ["POSITIVE", { sentiment: "POSITIVE", totalWords: 0, reviews: 0, averageWords: 0 }],
    ["NEUTRAL", { sentiment: "NEUTRAL", totalWords: 0, reviews: 0, averageWords: 0 }],
    ["NEGATIVE", { sentiment: "NEGATIVE", totalWords: 0, reviews: 0, averageWords: 0 }]
  ]);
  const tokenCounters = {
    ALL: new Map(),
    POSITIVE: new Map(),
    NEUTRAL: new Map(),
    NEGATIVE: new Map()
  };
  const tokenTotals = {
    ALL: 0,
    POSITIVE: 0,
    NEUTRAL: 0,
    NEGATIVE: 0
  };
  const documentFrequency = new Map();

  for (const row of rows) {
    const sentiment = row.predicted_label;
    const tokens = tokenize(row.clean_text);
    const terms = extractTerms(tokens);
    const lengthStats = lengthStatsMap.get(sentiment);

    if (lengthStats) {
      lengthStats.totalWords += tokens.length;
      lengthStats.reviews += 1;
    }

    const uniqueTerms = new Set(terms);

    for (const term of uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
      tokenCounters.ALL.set(term, (tokenCounters.ALL.get(term) || 0) + 1);
      tokenCounters[sentiment].set(term, (tokenCounters[sentiment].get(term) || 0) + 1);
      tokenTotals.ALL += 1;
      tokenTotals[sentiment] += 1;
    }

    if (row.aspect_count > 0) {
      coverage.withAspects += 1;
    } else {
      coverage.withoutAspects += 1;
    }

    for (const aspect of row.aspects) {
      if (!aspectSentimentMap.has(aspect)) {
        aspectSentimentMap.set(aspect, {
          aspect,
          POSITIVE: 0,
          NEUTRAL: 0,
          NEGATIVE: 0,
          total: 0
        });
      }

      const entry = aspectSentimentMap.get(aspect);
      entry[sentiment] += 1;
      entry.total += 1;
    }
  }

  const aspectSentiment = [...aspectSentimentMap.values()]
    .sort((left, right) => right.total - left.total)
    .slice(0, 8);

  const reviewLengthStats = [...lengthStatsMap.values()].map((item) => ({
    sentiment: item.sentiment,
    averageWords: item.reviews === 0 ? 0 : Number((item.totalWords / item.reviews).toFixed(1)),
    reviews: item.reviews
  }));
  const allowedTerms = selectWordCloudTerms(documentFrequency, rows.length, category);

  return {
    aspectSentiment,
    tokenFrequencies: {
      POSITIVE: buildTokenList(tokenCounters.POSITIVE),
      NEGATIVE: buildTokenList(tokenCounters.NEGATIVE),
      NEUTRAL: buildTokenList(tokenCounters.NEUTRAL)
    },
    reviewLengthStats,
    aspectCoverageBreakdown: [
      { name: "With aspects", value: coverage.withAspects },
      { name: "Without aspects", value: coverage.withoutAspects }
    ],
    wordCloud: {
      ALL: buildWordCloudList(new Map([...tokenCounters.ALL.entries()].filter(([text]) => allowedTerms.has(text)))),
      POSITIVE: buildDistinctiveWordCloud(tokenCounters.POSITIVE, tokenCounters, tokenTotals, "POSITIVE", allowedTerms),
      NEUTRAL: buildDistinctiveWordCloud(tokenCounters.NEUTRAL, tokenCounters, tokenTotals, "NEUTRAL", allowedTerms),
      NEGATIVE: buildDistinctiveWordCloud(tokenCounters.NEGATIVE, tokenCounters, tokenTotals, "NEGATIVE", allowedTerms)
    }
  };
}

function buildProgressOnlyResponse(run) {
  return {
    ...run,
    hasCompletedResults: false,
    table: null
  };
}

function buildRunResponse(run, pageParams) {
  const hasCompletedResults = run.status === "completed" && Array.isArray(run.rows) && run.rows.length > 0;
  const visualizations = hasCompletedResults ? buildVisualizations(run.rows, run.category) : null;

  return {
    ...run,
    hasCompletedResults,
    aspectSentiment: visualizations?.aspectSentiment || [],
    tokenFrequencies: visualizations?.tokenFrequencies || null,
    reviewLengthStats: visualizations?.reviewLengthStats || [],
    aspectCoverageBreakdown: visualizations?.aspectCoverageBreakdown || [],
    wordCloud: visualizations?.wordCloud || null,
    table: hasCompletedResults ? paginateRows(run.rows, pageParams) : null
  };
}

app.get("/api/config", async (request, response, next) => {
  try {
    const session = await requireSession(request, response);
    if (!session) {
      return;
    }

    response.json({ categories: Object.keys(CATEGORY_ASPECTS) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/runs", async (request, response, next) => {
  try {
    const session = await requireSession(request, response);
    if (!session) {
      return;
    }

    response.json(await listRunsByUser(session.user.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/runs", upload.single("file"), async (request, response, next) => {
  try {
    const session = await requireSession(request, response);
    if (!session) {
      return;
    }

    if (!request.file) {
      response.status(400).json({ error: "CSV file is required." });
      return;
    }

    const category = resolveCategory(request.body.category);
    const { records, columns } = parseCsvBuffer(request.file.buffer);

    if (records.length === 0) {
      response.status(400).json({ error: "The uploaded CSV does not contain any data rows." });
      return;
    }

    const detectedTextColumn = detectTextColumn(records, columns);
    const textColumn = request.body.textColumn || detectedTextColumn;

    if (!textColumn || !columns.includes(textColumn)) {
      response.status(400).json({ error: "A valid text column is required.", columns, detectedTextColumn });
      return;
    }

    const savedRun = await createQueuedRun({
      userId: session.user.id,
      filename: request.file.originalname,
      category,
      textColumn,
      detectedTextColumn,
      columns,
      rowCount: records.length
    });

    console.log(
      `[run:queued] user=${session.user.id} id=${savedRun.id} file="${request.file.originalname}" category=${category} detectedColumn="${detectedTextColumn}" selectedColumn="${textColumn}" totalRows=${records.length}`
    );

    enqueueRunProcessing({
      runId: savedRun.id,
      userId: session.user.id,
      category,
      textColumn,
      records,
      analyzer
    });

    response.status(202).json(savedRun);
  } catch (error) {
    next(error);
  }
});

app.post("/api/runs/:id/cancel", async (request, response, next) => {
  try {
    const session = await requireSession(request, response);
    if (!session) {
      return;
    }

    const run = await requestRunCancel(request.params.id, session.user.id);

    if (!run) {
      const existingRun = await getRunMetadataByIdForUser(request.params.id, session.user.id);

      if (!existingRun) {
        response.status(404).json({ error: "Run not found." });
        return;
      }

      response.status(409).json({ error: `Run cannot be canceled while in ${existingRun.status} state.` });
      return;
    }

    console.log(`[run:cancel-request] user=${session.user.id} id=${run.id} status=${run.status}`);
    response.json(run);
  } catch (error) {
    next(error);
  }
});

app.get("/api/runs/:id", async (request, response, next) => {
  try {
    const session = await requireSession(request, response);
    if (!session) {
      return;
    }

    const runMeta = await getRunMetadataByIdForUser(request.params.id, session.user.id);

    if (!runMeta) {
      response.status(404).json({ error: "Run not found." });
      return;
    }

    if (runMeta.status === "queued" || runMeta.status === "processing") {
      response.json(buildProgressOnlyResponse(runMeta));
      return;
    }

    if (runMeta.status === "failed" || runMeta.status === "canceled") {
      response.json(buildProgressOnlyResponse(runMeta));
      return;
    }

    const run = await getRunByIdForUser(request.params.id, session.user.id);

    if (!run) {
      response.status(404).json({ error: "Run not found." });
      return;
    }

    const page = Number(request.query.page || 1);
    const pageSize = Number(request.query.pageSize || 20);
    const search = String(request.query.search || "");
    const sentiment = String(request.query.sentiment || "ALL").toUpperCase();

    response.json(buildRunResponse(run, { page, pageSize, search, sentiment }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/runs/:id/export", async (request, response, next) => {
  try {
    const session = await requireSession(request, response);
    if (!session) {
      return;
    }

    const run = await getRunByIdForUser(request.params.id, session.user.id);

    if (!run) {
      response.status(404).json({ error: "Run not found." });
      return;
    }

    if (run.status !== "completed" || run.rows.length === 0) {
      response.status(409).json({ error: "Export is available only after a run completes." });
      return;
    }

    const csvContent = stringifyRows(buildExportRows(run.rows));
    const baseName = run.filename.replace(/\.csv$/i, "");

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${run.id}-${baseName}-analyzed.csv"`);
    response.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
});

const clientDist = path.resolve("dist");
app.use(express.static(clientDist));
app.get("*", async (request, response, next) => {
  if (request.path.startsWith("/api/")) {
    next();
    return;
  }

  try {
    await fs.access(path.join(clientDist, "index.html"));
    response.sendFile(path.join(clientDist, "index.html"));
  } catch {
    response.status(200).send("Sentiment Analysis API is running. Start the Vite client during development.");
  }
});

app.use((error, _request, response, _next) => {
  console.error("[server:error]", error);
  response.status(500).json({ error: error?.message || "Unexpected server error." });
});

await connectDatabase();
const interruptedRuns = await markActiveRunsInterrupted();

if (interruptedRuns > 0) {
  console.warn(`[run:recovery] marked ${interruptedRuns} interrupted run(s) as failed after server startup`);
}

app.listen(PORT, HOST, () => {
  console.log(`Sentiment app server listening on http://${HOST}:${PORT}`);
});
