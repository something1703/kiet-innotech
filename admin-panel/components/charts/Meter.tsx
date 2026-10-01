import { formatNumber } from "@/lib/format";
import { accent, accentTrack } from "./palette";

/** A share against its whole, e.g. students already in a team. The track is a lighter step of the fill's hue. */
export function Meter({ label, value, total, note }: { label: string; value: number; total: number; note?: string }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-navy-800">{label}</p>
        <p className="font-display text-2xl font-bold text-navy-900">{percent}%</p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full"
        style={{ background: accentTrack }}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
      >
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: accent }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {formatNumber(value)} of {formatNumber(total)}
        {note ? ` · ${note}` : ""}
      </p>
    </div>
  );
}
