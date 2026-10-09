import { yearLabel } from "@/lib/rules";
import type { ParticipantType } from "@/lib/types";

const short = (year: number, type: ParticipantType) => (type === "school" ? `Cl ${year}` : `Y${year}`);

/** Each member's year (or class), the leader's first and outlined: e.g. [Y3] Y2 Y2 Y1. */
export function YearChips({ years, type }: { years: number[]; type: ParticipantType }) {
  if (years.length === 0) return <span className="text-muted">—</span>;
  // A startup has no year of study.
  if (type === "startup") return <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-inset ring-violet-200">Startup</span>;
  const [leader, ...rest] = years;
  const label = `Leader ${yearLabel(leader, type)}${rest.length ? `; members ${rest.map((y) => yearLabel(y, type)).join(", ")}` : ""}`;
  return (
    <span className="inline-flex flex-wrap gap-1" title={label} aria-label={label}>
      <span className="rounded-md bg-navy-900 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">{short(leader, type)}</span>
      {rest.map((year, index) => (
        <span key={index} className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-navy-800 ring-1 ring-inset ring-line">
          {short(year, type)}
        </span>
      ))}
    </span>
  );
}
