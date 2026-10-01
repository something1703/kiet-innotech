"use client";

import { useState, type ReactNode } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Notice } from "./Notice";

export type ExportScope = "selected" | "page" | "matching" | "all";
export type ExportFormat = "xlsx" | "csv";

/** Choose which rows to export (ticked, this page, everything matching the filters, everything) and the format. */
export function ExportDialog({
  noun,
  counts,
  filtered,
  formatNote,
  onExport,
  onClose,
}: {
  noun: { one: string; many: string };
  counts: { selected: number; page: number; matching: number };
  filtered: boolean;
  /** What the Excel file contains, e.g. "A Teams sheet and a Members sheet." */
  formatNote: ReactNode;
  onExport: (scope: ExportScope, format: ExportFormat) => Promise<void>;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<ExportScope>(counts.selected ? "selected" : "matching");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = (n: number) => `${formatNumber(n)} ${n === 1 ? noun.one : noun.many}`;

  const scopes: { value: ExportScope; label: string; hint: string; disabled?: boolean }[] = [
    {
      value: "selected",
      label: `Selected rows (${formatNumber(counts.selected)})`,
      hint: counts.selected ? "The rows you ticked, on any page." : "Tick rows in the table first.",
      disabled: counts.selected === 0,
    },
    { value: "page", label: `This page (${formatNumber(counts.page)})`, hint: "The rows shown right now." },
    {
      value: "matching",
      label: filtered ? `All matching the filters (${formatNumber(counts.matching)})` : `All ${noun.many} (${formatNumber(counts.matching)})`,
      hint: filtered ? "Every page of the current search and filters, in the current sort order." : "Every page, in the current sort order.",
    },
    ...(filtered ? [{ value: "all" as const, label: `All ${noun.many}, ignoring the filters`, hint: "Everything you have access to." }] : []),
  ];

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await onExport(scope, format);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={`Export ${noun.many}`}
      description="Download the rows you need as an Excel workbook or a CSV file."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={run} pending={busy}>
            {!busy && <Download aria-hidden="true" className="size-4" />}
            Download {format === "xlsx" ? "Excel" : "CSV"}
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted">Rows</legend>
        <div className="mt-2 space-y-1.5">
          {scopes.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset transition ${
                scope === option.value ? "bg-brand-50 ring-brand-300" : "ring-line hover:bg-surface"
              } ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="export-scope"
                value={option.value}
                checked={scope === option.value}
                disabled={option.disabled || busy}
                onChange={() => setScope(option.value)}
                className="mt-0.5 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-semibold text-navy-900">{option.label}</span>
                <span className="block text-xs text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted">Format</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              { value: "xlsx", label: "Excel (.xlsx)", hint: formatNote, icon: FileSpreadsheet },
              { value: "csv", label: "CSV", hint: "Plain text, for other tools. One row per member for teams.", icon: FileText },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset transition ${
                format === option.value ? "bg-brand-50 ring-brand-300" : "ring-line hover:bg-surface"
              }`}
            >
              <input
                type="radio"
                name="export-format"
                value={option.value}
                checked={format === option.value}
                disabled={busy}
                onChange={() => setFormat(option.value)}
                className="mt-0.5 accent-brand-600"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
                  <option.icon aria-hidden="true" className="size-4 text-brand-600" />
                  {option.label}
                </span>
                <span className="block text-xs text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="mt-4 text-xs text-muted">
        {scope === "selected" ? count(counts.selected) : scope === "page" ? count(counts.page) : scope === "matching" ? count(counts.matching) : `All ${noun.many}`} will be
        exported. Exports contain personal data: share them only with the organising team.
      </p>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Dialog>
  );
}
