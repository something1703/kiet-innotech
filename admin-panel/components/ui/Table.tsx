import type { ReactNode, ThHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortOrder } from "@/lib/admin-types";

export const thClass =
  "whitespace-nowrap border-b border-line bg-surface px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted";
export const tdClass = "border-b border-line px-3 py-2.5 align-top";
export const numClass = "text-right tabular-nums";

/** A white panel whose table scrolls horizontally inside itself on narrow screens. */
export function TableFrame({ label, children, minWidth = "min-w-[720px]" }: { label: string; children: ReactNode; minWidth?: string }) {
  return (
    // `relative` keeps absolutely positioned children (e.g. sr-only text) inside the scroll container.
    <div className="relative overflow-x-auto rounded-2xl bg-white ring-1 ring-line" role="region" aria-label={label} tabIndex={0}>
      <table className={`w-full ${minWidth} border-separate border-spacing-0 text-sm`}>{children}</table>
    </div>
  );
}

export function Th({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={`${thClass} ${className}`} {...props} />;
}

export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  order,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: K;
  sort: K;
  order: SortOrder;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sort === sortKey;
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"} className={`${thClass} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`-mx-1 inline-flex items-center gap-1 rounded px-1 uppercase tracking-wider transition hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-brand-500 ${active ? "text-navy-900" : ""}`}
      >
        {label}
        <Icon aria-hidden="true" className={`size-3 ${active ? "text-brand-600" : "opacity-50"}`} />
      </button>
    </th>
  );
}
