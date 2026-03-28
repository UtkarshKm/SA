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
  requestRunCancel
} from "./lib/runRepository.js";
import { enqueueRunProcessing } from "./lib/runProcessor.js";
import { SentimentAnalyzer } from "./lib/sentiment.js";
import { detectTextColumn } from "./lib/text.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const analyzer = new SentimentAnalyzer();
const PORT = Number(process.env.PORT || 3001);

app.use(cors({ origin: true, credentials: true }));
app.use((request, _response, next) => {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.path}`);
  next();
});

app.all("/api/auth/*", authHandler);
app.use(express.json({ limit: "2mb" }));

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

function buildProgressOnlyResponse(run) {
  return {
    ...run,
    hasCompletedResults: false,
    table: null
  };
}

function buildRunResponse(run, pageParams) {
  const hasCompletedResults = run.status === "completed" && Array.isArray(run.rows) && run.rows.length > 0;

  return {
    ...run,
    hasCompletedResults,
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

app.listen(PORT, () => {
  console.log(`Sentiment app server listening on http://localhost:${PORT}`);
});
