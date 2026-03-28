const COMMON_TEXT_COLUMNS = [
  "Review",
  "review",
  "text",
  "Text",
  "comment",
  "Comment",
  "feedback",
  "Feedback",
  "content",
  "Content",
  "reviews"
];

export function detectTextColumn(rows, columns) {
  for (const candidate of COMMON_TEXT_COLUMNS) {
    if (columns.includes(candidate)) {
      return candidate;
    }
  }

  let bestColumn = null;
  let bestScore = -1;

  for (const column of columns) {
    const values = rows
      .map((row) => String(row[column] ?? "").trim())
      .filter(Boolean)
      .slice(0, 50);

    if (values.length === 0) {
      continue;
    }

    const averageLength =
      values.reduce((total, value) => total + value.length, 0) / values.length;

    if (averageLength > 20 && averageLength > bestScore) {
      bestScore = averageLength;
      bestColumn = column;
    }
  }

  return bestColumn;
}

export function normalizeText(input) {
  return String(input ?? "")
    .replace(/http\S+|www\.\S+/gi, " ")
    .replace(/@\w+/g, " ")
    .replace(/[_*~`#%^&+=<>|/\\-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function filterValidRows(rows, textColumn) {
  const keptRows = [];
  let removedCount = 0;

  for (const row of rows) {
    const raw = row[textColumn];
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      removedCount += 1;
      continue;
    }

    keptRows.push(row);
  }

  return { keptRows, removedCount };
}
