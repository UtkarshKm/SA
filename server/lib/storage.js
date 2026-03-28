import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const RUNS_DIR = path.join(DATA_DIR, "runs");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

export async function ensureStorage() {
  await fs.mkdir(RUNS_DIR, { recursive: true });

  try {
    await fs.access(INDEX_PATH);
  } catch {
    await fs.writeFile(INDEX_PATH, "[]", "utf8");
  }
}

export async function readIndex() {
  const raw = await fs.readFile(INDEX_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeIndex(index) {
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
}

export async function createRunDirectory(runId) {
  const runDir = path.join(RUNS_DIR, runId);
  await fs.mkdir(runDir, { recursive: true });
  return runDir;
}

export async function saveRunArtifacts({
  runId,
  originalBuffer,
  originalFileName,
  rows,
  metadata,
  csvContent
}) {
  const runDir = await createRunDirectory(runId);
  await fs.writeFile(path.join(runDir, originalFileName), originalBuffer);
  await fs.writeFile(path.join(runDir, "rows.json"), JSON.stringify(rows, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "output.csv"), csvContent, "utf8");
  return runDir;
}

export async function readRunMetadata(runId) {
  const raw = await fs.readFile(path.join(RUNS_DIR, runId, "metadata.json"), "utf8");
  return JSON.parse(raw);
}

export async function readRunRows(runId) {
  const raw = await fs.readFile(path.join(RUNS_DIR, runId, "rows.json"), "utf8");
  return JSON.parse(raw);
}

export function getExportPath(runId) {
  return path.join(RUNS_DIR, runId, "output.csv");
}
