export function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function previewCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = parseCsvLine(lines[0]);
  const rows = lines.slice(1, 8).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(columns.map((column, index) => [column, values[index] || ""]));
  });

  return { columns, rows };
}

export function autoDetectTextColumn(columns, rows) {
  const preferred = [
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

  for (const candidate of preferred) {
    if (columns.includes(candidate)) {
      return candidate;
    }
  }

  let best = columns[0] || "";
  let bestScore = -1;

  for (const column of columns) {
    const values = rows.map((row) => String(row[column] || "").trim()).filter(Boolean);
    if (values.length === 0) {
      continue;
    }

    const averageLength =
      values.reduce((total, value) => total + value.length, 0) / values.length;

    if (averageLength > bestScore) {
      best = column;
      bestScore = averageLength;
    }
  }

  return best;
}
