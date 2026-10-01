import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { Button } from "./Button";
import { PAGE_SIZES } from "@/lib/use-url-params";

/** The last page number for a paged response (1 when it is empty). */
export function lastPage({ total, pageSize }: { total: number; pageSize: number }) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  disabled = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = lastPage({ total, pageSize });
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      {from > total ? (
        <p aria-live="polite">
          Past the last page of <span className="font-semibold text-navy-900">{formatNumber(total)}</span>
        </p>
      ) : (
        <p aria-live="polite">
          Showing <span className="font-semibold text-navy-900">{formatNumber(from)}</span>–
          <span className="font-semibold text-navy-900">{formatNumber(to)}</span> of{" "}
          <span className="font-semibold text-navy-900">{formatNumber(total)}</span>
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={disabled || page <= 1} aria-label="Previous page">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Prev
        </Button>
        <span className="tabular-nums">
          Page {page} of {pages}
        </span>
        <Button variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={disabled || page >= pages} aria-label="Next page">
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </nav>
  );
}

/** Rows per page; changing it goes back to page 1. */
export function PageSizeSelect({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted">
      Rows per page
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-full bg-white px-3 text-xs font-semibold text-navy-900 ring-1 ring-inset ring-line focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
