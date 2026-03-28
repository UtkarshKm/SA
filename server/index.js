import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import multer from "multer";
import { CATEGORY_ASPECTS, extractAspects, resolveCategory } from "./lib/aspects.js";
import { parseCsvBuffer, stringifyRows } from "./lib/csv.js";
import { SentimentAnalyzer } from "./lib/sentiment.js";
import { detectTextColumn, filterValidRows, normalizeText } from "./lib/text.js";
import {
  ensureStorage,
  getExportPath,
  readIndex,
  readRunMetadata,
  readRunRows,
  saveRunArtifacts,
  writeIndex
} from "./lib/storage.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const analyzer = new SentimentAnalyzer();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use((request, _response, next) => {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.path}`);
  next();
});

function summarizeRows(rows) {
  const sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
  const aspectCounts = new Map();
  let rowsWithAspects = 0;

  for (const row of rows) {
    sentimentCounts[row.predicted_label] = (sentimentCounts[row.predicted_label] || 0) + 1;

    if (row.aspect_count > 0) {
      rowsWithAspects += 1;
    }

    for (const aspect of row.aspects) {
      aspectCounts.set(aspect, (aspectCounts.get(aspect) || 0) + 1);
    }
  }

  const topAspects = [...aspectCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    sentimentCounts,
    topAspects,
    aspectCoverage: rows.length === 0 ? 0 : Number(((rowsWithAspects / rows.length) * 100).toFixed(1))
  };
}

function paginateRows(rows, { page = 1, pageSize = 20, search = "", sentiment = "ALL" }) {
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const matchesSentiment = sentiment === "ALL" ? true : row.predicted_label === sentiment;
    const matchesSearch =
      normalizedSearch === ""
        ? true
        : row.clean_text.includes(normalizedSearch) ||
          row.original_text.toLowerCase().includes(normalizedSearch) ||
          row.aspects.join(" ").includes(normalizedSearch);

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

app.get("/api/config", (_request, response) => {
  response.json({ categories: Object.keys(CATEGORY_ASPECTS) });
});

app.get("/api/runs", async (_request, response, next) => {
  try {
    response.json(await readIndex());
  } catch (error) {
    next(error);
  }
});

app.post("/api/runs", upload.single("file"), async (request, response, next) => {
  try {
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

    console.log(
      `[run:start] file="${request.file.originalname}" category=${category} detectedColumn="${detectedTextColumn}" selectedColumn="${textColumn}" totalRows=${records.length}`
    );

    if (!textColumn || !columns.includes(textColumn)) {
      response.status(400).json({ error: "A valid text column is required.", columns, detectedTextColumn });
      return;
    }

    const { keptRows, removedCount } = filterValidRows(records, textColumn);

    if (keptRows.length === 0) {
      response.status(400).json({ error: "No non-empty rows were found in the selected text column." });
      return;
    }

    const normalizedTexts = keptRows.map((row) => normalizeText(row[textColumn]));
    const sentiments = await analyzer.analyze(normalizedTexts);

    const enrichedRows = keptRows.map((row, index) => {
      const cleanText = normalizedTexts[index];
      const aspects = extractAspects(cleanText, category);
      const sentiment = sentiments[index];

      return {
        ...row,
        original_text: String(row[textColumn] ?? ""),
        clean_text: cleanText,
        predicted_label: sentiment.label,
        confidence: sentiment.confidence,
        aspects,
        aspect_count: aspects.length
      };
    });

    const summary = summarizeRows(enrichedRows);
    const metadata = {
      id: crypto.randomUUID(),
      filename: request.file.originalname,
      category,
      textColumn,
      detectedTextColumn,
      columns,
      createdAt: new Date().toISOString(),
      status: "completed",
      rowCount: records.length,
      validRowCount: enrichedRows.length,
      removedCount,
      modelMode: analyzer.mode,
      summary
    };

    console.log(
      `[run:complete] id=${metadata.id} validRows=${metadata.validRowCount} removedRows=${metadata.removedCount} modelMode=${metadata.modelMode} aspectCoverage=${metadata.summary.aspectCoverage}%`
    );

    await saveRunArtifacts({
      runId: metadata.id,
      originalBuffer: request.file.buffer,
      originalFileName: request.file.originalname,
      rows: enrichedRows,
      metadata,
      csvContent: stringifyRows(enrichedRows)
    });

    const index = await readIndex();
    index.unshift({
      id: metadata.id,
      filename: metadata.filename,
      category: metadata.category,
      textColumn: metadata.textColumn,
      createdAt: metadata.createdAt,
      status: metadata.status,
      rowCount: metadata.rowCount,
      validRowCount: metadata.validRowCount,
      modelMode: metadata.modelMode,
      summary: metadata.summary
    });
    await writeIndex(index);

    response.status(201).json(metadata);
  } catch (error) {
    next(error);
  }
});

app.get("/api/runs/:id", async (request, response, next) => {
  try {
    const metadata = await readRunMetadata(request.params.id);
    const rows = await readRunRows(request.params.id);
    const page = Number(request.query.page || 1);
    const pageSize = Number(request.query.pageSize || 20);
    const search = String(request.query.search || "");
    const sentiment = String(request.query.sentiment || "ALL").toUpperCase();

    response.json({
      ...metadata,
      table: paginateRows(rows, { page, pageSize, search, sentiment })
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/runs/:id/export", async (request, response, next) => {
  try {
    const metadata = await readRunMetadata(request.params.id);
    const exportPath = getExportPath(request.params.id);
    await fs.access(exportPath);
    response.download(exportPath, `${metadata.id}-${metadata.filename.replace(/\.csv$/i, "")}-analyzed.csv`);
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

await ensureStorage();

app.listen(PORT, () => {
  console.log(`Sentiment app server listening on http://localhost:${PORT}`);
});
