import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export function parseCsvBuffer(buffer) {
  const content = buffer.toString("utf8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true
  });

  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  return { records, columns };
}

export function stringifyRows(rows) {
  return stringify(rows, { header: true });
}
