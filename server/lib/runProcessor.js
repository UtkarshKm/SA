import { extractAspects } from "./aspects.js";
import {
  getRunJobState,
  markRunCanceled,
  markRunCompleted,
  markRunFailed,
  updateRunProgress
} from "./runRepository.js";
import { filterValidRows, normalizeText } from "./text.js";

const activeJobs = new Set();
const ANALYSIS_BATCH_SIZE = 8;
const ASPECT_BATCH_SIZE = 40;

class RunCanceledError extends Error {
  constructor(message = "Run canceled before completion.") {
    super(message);
    this.name = "RunCanceledError";
  }
}

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

function buildStoredRow(row, textColumn, cleanText, sentiment, category) {
  const aspects = extractAspects(cleanText, category);

  return {
    sourceRow: row,
    original_text: String(row[textColumn] ?? ""),
    clean_text: cleanText,
    predicted_label: sentiment.label,
    confidence: sentiment.confidence,
    aspects,
    aspect_count: aspects.length
  };
}

function buildInferencePercent(processed, total) {
  if (total === 0) {
    return 10;
  }

  return Math.min(85, 10 + Math.round((processed / total) * 75));
}

function buildAspectPercent(processed, total) {
  if (total === 0) {
    return 95;
  }

  return Math.min(95, 85 + Math.round((processed / total) * 10));
}

async function ensureNotCanceled(runId, userId, fallbackMessage) {
  const state = await getRunJobState(runId, userId);

  if (!state) {
    throw new Error("Run no longer exists.");
  }

  if (state.cancelRequested) {
    await markRunCanceled(runId, userId, fallbackMessage);
    throw new RunCanceledError(fallbackMessage);
  }
}

async function setStage(runId, userId, { stage, message, percent, status = "processing", extra = {} }) {
  await updateRunProgress(runId, userId, {
    status,
    stage,
    message,
    percent,
    ...extra
  });
}

async function processRun(job) {
  const { runId, userId, category, textColumn, records, analyzer } = job;

  if (activeJobs.has(runId)) {
    return;
  }

  activeJobs.add(runId);

  try {
    await setStage(runId, userId, {
      stage: "processing started",
      message: "Preparing the analysis job.",
      percent: 2,
      extra: {
        processingStartedAt: new Date(),
        processingCompletedAt: null,
        lastProcessedAt: null,
        errorMessage: "",
        cancelRequested: false
      }
    });
    console.log(`[run:processing] user=${userId} id=${runId} stage="processing started"`);

    await ensureNotCanceled(runId, userId, "Run canceled before parsing started.");
    await setStage(runId, userId, {
      stage: "parsing csv",
      message: `Parsed ${records.length} CSV rows into memory.`,
      percent: 5
    });
    console.log(`[run:parsing] user=${userId} id=${runId} totalRows=${records.length}`);

    await ensureNotCanceled(runId, userId, "Run canceled while parsing CSV rows.");
    const { keptRows, removedCount } = filterValidRows(records, textColumn);

    if (keptRows.length === 0) {
      throw new Error("No non-empty rows were found in the selected text column.");
    }

    await setStage(runId, userId, {
      stage: "validating rows",
      message: `Validated ${keptRows.length} rows. Removed ${removedCount} empty rows.`,
      percent: 8,
      extra: {
        validRowCount: keptRows.length,
        removedCount
      }
    });
    console.log(
      `[run:validate] user=${userId} id=${runId} selectedColumn="${textColumn}" validRows=${keptRows.length} removedRows=${removedCount}`
    );

    await ensureNotCanceled(runId, userId, "Run canceled while validating rows.");
    const normalizedTexts = keptRows.map((row) => normalizeText(row[textColumn]));

    await setStage(runId, userId, {
      stage: "running sentiment inference",
      message: `Loading ${analyzer.modelName} on ${analyzer.mode === "pending" ? "available" : analyzer.mode}.`,
      percent: 10,
      extra: {
        modelMode: analyzer.mode,
        modelName: analyzer.modelName
      }
    });
    console.log(`[run:inference:start] user=${userId} id=${runId} modelMode=${analyzer.mode} modelName=${analyzer.modelName}`);

    const sentiments = await analyzer.analyze(normalizedTexts, {
      batchSize: ANALYSIS_BATCH_SIZE,
      onBatchComplete: async ({ processed, total, mode }) => {
        await ensureNotCanceled(runId, userId, `Run canceled after analyzing ${processed} rows.`);

        const percent = buildInferencePercent(processed, total);
        await setStage(runId, userId, {
          stage: "running sentiment inference",
          message: `Analyzed ${processed} of ${total} rows with ${analyzer.modelName}.`,
          percent,
          extra: {
            modelMode: mode || analyzer.mode,
            modelName: analyzer.modelName
          }
        });
        console.log(`[run:inference] user=${userId} id=${runId} processed=${processed}/${total} modelMode=${mode || analyzer.mode}`);
      }
    });

    await ensureNotCanceled(runId, userId, "Run canceled after sentiment inference.");
    await setStage(runId, userId, {
      stage: "extracting aspects",
      message: "Extracting category-aligned aspects from normalized reviews.",
      percent: 85,
      extra: {
        modelMode: analyzer.mode,
        modelName: analyzer.modelName
      }
    });
    console.log(`[run:aspects:start] user=${userId} id=${runId} category=${category}`);

    const storedRows = [];
    for (let index = 0; index < keptRows.length; index += ASPECT_BATCH_SIZE) {
      await ensureNotCanceled(runId, userId, `Run canceled while extracting aspects after ${index} rows.`);

      const rowBatch = keptRows.slice(index, index + ASPECT_BATCH_SIZE);
      for (let offset = 0; offset < rowBatch.length; offset += 1) {
        const absoluteIndex = index + offset;
        storedRows.push(
          buildStoredRow(
            rowBatch[offset],
            textColumn,
            normalizedTexts[absoluteIndex],
            sentiments[absoluteIndex],
            category
          )
        );
      }

      const processed = Math.min(index + rowBatch.length, keptRows.length);
      await setStage(runId, userId, {
        stage: "extracting aspects",
        message: `Built enriched rows for ${processed} of ${keptRows.length} reviews.`,
        percent: buildAspectPercent(processed, keptRows.length)
      });
      console.log(`[run:aspects] user=${userId} id=${runId} processed=${processed}/${keptRows.length}`);
    }

    await ensureNotCanceled(runId, userId, "Run canceled before saving results.");
    await setStage(runId, userId, {
      stage: "saving results",
      message: "Saving analyzed rows and summary to MongoDB.",
      percent: 95
    });
    console.log(`[run:save] user=${userId} id=${runId} validRows=${storedRows.length} removedRows=${removedCount}`);

    const summary = summarizeRows(storedRows);
    const savedRun = await markRunCompleted(runId, userId, {
      rowCount: records.length,
      validRowCount: storedRows.length,
      removedCount,
      modelMode: analyzer.mode,
      modelName: analyzer.modelName,
      summary,
      rows: storedRows
    });

    console.log(
      `[run:complete] user=${userId} id=${runId} validRows=${savedRun.validRowCount} removedRows=${savedRun.removedCount} modelMode=${savedRun.modelMode} modelName=${savedRun.modelName} aspectCoverage=${savedRun.summary.aspectCoverage}%`
    );
  } catch (error) {
    if (error instanceof RunCanceledError) {
      console.log(`[run:canceled] user=${userId} id=${runId} reason="${error.message}"`);
      return;
    }

    const message = error?.message || "Unexpected processing failure.";
    await markRunFailed(runId, userId, message);
    console.error(`[run:failed] user=${userId} id=${runId} message="${message}"`);
  } finally {
    activeJobs.delete(runId);
  }
}

export function enqueueRunProcessing(job) {
  setImmediate(() => {
    processRun(job).catch((error) => {
      console.error("[run:queue:error]", error);
    });
  });
}
