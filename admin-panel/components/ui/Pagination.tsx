import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { Button } from "./Button";

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
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <p aria-live="polite">
        Showing <span className="font-semibold text-navy-900">{formatNumber(from)}</span>–
        <span className="font-semibold text-navy-900">{formatNumber(to)}</span> of{" "}
        <span className="font-semibold text-navy-900">{formatNumber(total)}</span>
      </p>
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
