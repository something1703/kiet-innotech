/** Builds a CSV file (RFC 4180, with a BOM so Excel reads UTF-8) and downloads it. */

/** Text that must stay text, such as phone and roll numbers. Create it with `asText`. */
type TextCell = { text: string };
type Cell = string | number | null | undefined | TextCell;

/** Keeps digit strings as text in Excel, so long roll numbers do not turn into 2.3E+12 and leading zeros survive. */
export function asText(value: string | null | undefined): TextCell {
  return { text: value ?? "" };
}

function escapeCell(value: Cell) {
  const keepText = typeof value === "object" && value !== null;
  let text = typeof value === "object" && value !== null ? value.text : value === null || value === undefined ? "" : String(value);
  // Stop spreadsheet apps from treating cell text as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  // A leading tab (added after the formula check, so it cannot hide one) makes Excel read the cell as text.
  if (keepText && text) text = `\t${text}`;
  return /[",\r\n\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** e.g. "innotech26-teams-2026-10-12.csv" */
export function csvFilename(name: string) {
  return `innotech26-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
}
