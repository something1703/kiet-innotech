/** Builds a CSV file (RFC 4180, with a BOM so Excel reads UTF-8) and downloads it. */

type Cell = string | number | null | undefined;

function escapeCell(value: Cell) {
  let text = value === null || value === undefined ? "" : String(value);
  // Stop spreadsheet apps from treating cell text as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
