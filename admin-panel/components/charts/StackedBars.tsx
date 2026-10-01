"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { Segmented } from "./ChartCard";
import { Legend } from "./Legend";
import type { Series } from "./palette";
import { Tooltip, useTooltip, type TooltipRow } from "./Tooltip";

export type BarRow<K extends string> = { key: string; label: string; hint?: string; href?: string; values: Record<K, number> };

type Sort = "total" | "label" | "first";

/**
 * Horizontal stacked bars, one row per item (a category, a department...), segments per series, all on one shared
 * scale so rows compare. Rows link to the matching filtered list. Hover or focus a row for every series' value.
 */
export function StackedBars<K extends string>({
  rows,
  series,
  noun = "teams",
  labelWidth = "9rem",
  sortable = true,
  legend = true,
}: {
  rows: BarRow<K>[];
  series: Series<K>[];
  noun?: string;
  labelWidth?: string;
  sortable?: boolean;
  /** Off for a single series: the chart's title already says what is plotted. */
  legend?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { tip, show, showAt, hide } = useTooltip(box);
  const [sort, setSort] = useState<Sort>("total");
  const total = (row: BarRow<K>) => series.reduce((sum, s) => sum + (row.values[s.key] ?? 0), 0);
  const max = Math.max(1, ...rows.map(total));

  const first = series[0].key;
  const sorted =
    sort === "label"
      ? rows
      : [...rows].sort((a, b) =>
          sort === "total"
            ? total(b) - total(a) || (b.values[first] ?? 0) - (a.values[first] ?? 0)
            : (b.values[first] ?? 0) - (a.values[first] ?? 0) || total(b) - total(a),
        );

  const totals = Object.fromEntries(series.map((s) => [s.key, formatNumber(rows.reduce((sum, r) => sum + (r.values[s.key] ?? 0), 0))]));
  const readout = (row: BarRow<K>): TooltipRow[] =>
    series.length === 1
      ? [{ color: series[0].color, label: series[0].label.toLowerCase(), value: formatNumber(total(row)) }]
      : [
          ...series.map((s) => ({ color: s.color, label: s.label, value: formatNumber(row.values[s.key] ?? 0) })),
          { label: `total ${noun}`, value: formatNumber(total(row)) },
        ];

  return (
    <div ref={box} className="relative" onPointerLeave={hide}>
      <div className={`flex flex-wrap items-center justify-between gap-2 ${legend || sortable ? "mb-3" : ""}`}>
        {legend && <Legend series={series} values={totals} />}
        {sortable && (
          <Segmented
            label="Sort rows"
            value={sort}
            onChange={setSort}
            options={[
              { value: "total", label: "Most" },
              { value: "first", label: `Most ${series[0].label.toLowerCase()}` },
              { value: "label", label: "Default order" },
            ]}
          />
        )}
      </div>
      <ol className="space-y-1">
        {sorted.map((row) => {
          const rowTotal = total(row);
          const visible = series.filter((s) => (row.values[s.key] ?? 0) > 0);
          const label = row.href ? (
            <Link href={row.href} className="truncate font-medium text-navy-900 hover:text-brand-700 hover:underline" onFocus={(e) => showAt(e.currentTarget, row.label, readout(row))} onBlur={hide}>
              {row.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-navy-900">{row.label}</span>
          );
          return (
            // Narrow cards (phones): label and total on one line, the bar full width under them. Wider: one line.
            <li
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_3.25rem] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-1 text-sm hover:bg-surface/80 @md:grid-cols-[minmax(0,var(--label))_minmax(0,1fr)_3.25rem]"
              style={{ "--label": labelWidth } as React.CSSProperties}
              onPointerMove={(e) => show(e.clientX, e.clientY, row.hint ? `${row.label} · ${row.hint}` : row.label, readout(row))}
            >
              <span className="col-start-1 row-start-1 flex min-w-0 flex-col leading-tight @md:col-auto @md:row-auto" title={row.hint ? `${row.label}: ${row.hint}` : row.label}>
                {label}
                {row.hint && <span className="truncate text-[11px] text-muted">{row.hint}</span>}
              </span>
              <span className="col-span-2 row-start-2 flex h-5 gap-[2px] @md:col-span-1 @md:row-auto" style={{ width: `${(rowTotal / max) * 100}%` }} aria-hidden="true">
                {visible.map((s, index) => (
                  <span
                    key={s.key}
                    className={`h-full min-w-[2px] ${index === visible.length - 1 ? "rounded-r-[4px]" : ""}`}
                    style={{ flex: `${row.values[s.key]} 1 0`, background: s.color }}
                  />
                ))}
              </span>
              <span className="col-start-2 row-start-1 text-right text-sm font-semibold tabular-nums text-navy-900 @md:col-auto @md:row-auto">{formatNumber(rowTotal)}</span>
              <span className="sr-only">{readout(row).map((r) => `${r.value} ${r.label}`).join(", ")}</span>
            </li>
          );
        })}
      </ol>
      <Tooltip tip={tip} />
    </div>
  );
}
