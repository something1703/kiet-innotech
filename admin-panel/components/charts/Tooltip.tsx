"use client";

import { useCallback, useState, type RefObject } from "react";

export type TooltipRow = { color?: string; label: string; value: string; line?: boolean };
export type TooltipState = { x: number; y: number; width: number; title: string; rows: TooltipRow[] } | null;

/** Hover/focus readout for a chart, positioned inside the chart's relative container. */
export function useTooltip(container: RefObject<HTMLElement | null>) {
  const [tip, setTip] = useState<TooltipState>(null);
  const show = useCallback(
    (clientX: number, clientY: number, title: string, rows: TooltipRow[]) => {
      const box = container.current?.getBoundingClientRect();
      if (!box) return;
      setTip({ x: clientX - box.left, y: clientY - box.top, width: box.width, title, rows });
    },
    [container],
  );
  /** For keyboard focus: anchor the readout to the focused element. */
  const showAt = useCallback(
    (element: Element, title: string, rows: TooltipRow[]) => {
      const rect = element.getBoundingClientRect();
      show(rect.left + rect.width / 2, rect.top, title, rows);
    },
    [show],
  );
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, showAt, hide };
}

/** Values lead (strong), labels follow; series keyed with a short colour mark. Kept inside the container. */
export function Tooltip({ tip }: { tip: TooltipState }) {
  if (!tip) return null;
  const boxWidth = 220;
  const left = Math.min(Math.max(tip.x - boxWidth / 2, 0), Math.max(tip.width - boxWidth, 0));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-line"
      style={{ left, top: Math.max(tip.y - 12, 0), width: boxWidth, transform: "translateY(-100%)" }}
    >
      <p className="mb-1 font-semibold text-navy-900">{tip.title}</p>
      <ul className="space-y-0.5">
        {tip.rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.color && (
              <span aria-hidden="true" className={row.line ? "h-0.5 w-3 rounded-full" : "size-2 rounded-[2px]"} style={{ background: row.color }} />
            )}
            <span className="font-semibold tabular-nums text-navy-900">{row.value}</span>
            <span className="truncate text-muted">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
