"use client";

import { useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";

/**
 * A chart in a white card: title, optional controls, the chart, and a table view of the same numbers (so nothing
 * depends on reading colours or hovering).
 */
export function ChartCard({
  title,
  description,
  controls,
  table,
  children,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  /** E.g. a sort or daily/cumulative switch, shown next to the chart/table toggle. */
  controls?: ReactNode;
  table: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={`@container min-w-0 rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5 ${className}`} aria-label={title}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-navy-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "chart" && controls}
          <Segmented
            label={`${title}: view`}
            value={view}
            onChange={setView}
            options={[
              { value: "chart", label: "Chart", icon: <BarChart3 className="size-3.5" aria-hidden="true" /> },
              { value: "table", label: "Table", icon: <Table2 className="size-3.5" aria-hidden="true" /> },
            ]}
          />
        </div>
      </header>
      {view === "chart" ? children : <div className="max-h-96 overflow-auto">{table}</div>}
    </section>
  );
}

/** A small pill-shaped switch between a few options. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-surface p-0.5 ring-1 ring-inset ring-line">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
            option.value === value ? "bg-white text-navy-900 shadow-sm ring-1 ring-line" : "text-muted hover:text-navy-900"
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A plain table for a card's table view. */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          {head.map((cell, index) => (
            <th
              key={cell}
              scope="col"
              className={`sticky top-0 border-b border-line bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted ${index ? "text-right" : "text-left"}`}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, index) => (
              <td key={index} className={`border-b border-line px-3 py-2 ${index ? "text-right tabular-nums" : "font-medium text-navy-900"}`}>
                {typeof cell === "number" ? new Intl.NumberFormat("en-IN").format(cell) : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
