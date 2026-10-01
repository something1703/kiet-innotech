import type { Series } from "./palette";

/** Series keys: the mark mirrors the chart (a swatch for bars and slices, a short line for lines). Text stays ink. */
export function Legend({ series, mark = "rect", values }: { series: Series[]; mark?: "rect" | "line"; values?: Record<string, string> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-navy-800">
      {series.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={mark === "line" ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-[3px]"}
            style={{ background: s.color }}
          />
          {s.label}
          {values?.[s.key] !== undefined && <span className="font-semibold tabular-nums text-navy-900">{values[s.key]}</span>}
        </li>
      ))}
    </ul>
  );
}
