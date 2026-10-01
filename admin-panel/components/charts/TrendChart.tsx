"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatNumber } from "@/lib/format";
import { Legend } from "./Legend";
import { chrome, type Series } from "./palette";

export type TrendPoint<K extends string> = { date: string; values: Record<K, number> };

const M = { top: 12, right: 14, bottom: 26, left: 40 };

/** 0, then round steps (1, 2, 5 x 10^n) up to at least `max`, about four of them. */
function ticks(max: number) {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Change over time for a few series on one axis (all are counts). A crosshair snaps to the nearest day and the
 * readout lists every series; arrow keys move it when the chart has focus.
 */
export function TrendChart<K extends string>({
  points,
  series,
  label,
  height: HEIGHT = 230,
}: {
  points: TrendPoint<K>[];
  series: Series<K>[];
  label: string;
  height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (points.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">Nothing to chart yet: registrations will appear here day by day.</p>;
  }

  const plotW = Math.max(width - M.left - M.right, 10);
  // Phones get a shorter chart, so it does not fill the whole screen.
  const height = width && width < 500 ? Math.min(HEIGHT, 240) : HEIGHT;
  const plotH = height - M.top - M.bottom;
  const max = Math.max(...points.flatMap((p) => series.map((s) => p.values[s.key])));
  const yTicks = ticks(max);
  const yMax = yTicks[yTicks.length - 1];
  const x = (i: number) => M.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 70))));

  const nearest = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - rect.left - M.left;
    const i = points.length === 1 ? 0 : Math.round((offset / plotW) * (points.length - 1));
    setIndex(Math.min(Math.max(i, 0), points.length - 1));
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : 1;
    setIndex((i) => Math.min(Math.max((i ?? points.length - 1) + step, 0), points.length - 1));
  };

  const hovered = index === null ? null : points[index];
  const tipLeft = index === null ? 0 : Math.min(Math.max(x(index) - 110, 0), Math.max(width - 220, 0));

  return (
    <div>
      <Legend series={series} mark="line" />
      <div ref={box} className="relative mt-3">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${label}. Use the left and right arrow keys to read each day.`}
            tabIndex={0}
            onPointerMove={nearest}
            onPointerLeave={() => setIndex(null)}
            onKeyDown={onKey}
            onBlur={() => setIndex(null)}
            className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line x1={M.left} x2={M.left + plotW} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? chrome.axis : chrome.grid} strokeWidth={1} />
                <text x={M.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={chrome.muted} className="tabular-nums">
                  {formatNumber(tick)}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % labelEvery === 0 || i === points.length - 1 ? (
                <text key={p.date} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={11} fill={chrome.muted}>
                  {dayLabel(p.date)}
                </text>
              ) : null,
            )}
            {index !== null && <line x1={x(index)} x2={x(index)} y1={M.top} y2={M.top + plotH} stroke={chrome.axis} strokeWidth={1} />}
            {series.map((s) => (
              <g key={s.key}>
                {points.length > 1 && (
                  <path
                    d={points.map((p, i) => `${i ? "L" : "M"} ${x(i)} ${y(p.values[s.key])}`).join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {(index !== null || points.length === 1) && (
                  <circle
                    cx={x(index ?? 0)}
                    cy={y(points[index ?? 0].values[s.key])}
                    r={4}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                )}
              </g>
            ))}
          </svg>
        )}
        {hovered && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-20 w-[220px] rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-line"
            style={{ left: tipLeft }}
          >
            <p className="mb-1 font-semibold text-navy-900">
              {new Date(`${hovered.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" })}
            </p>
            <ul className="space-y-0.5">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold tabular-nums text-navy-900">{formatNumber(hovered.values[s.key])}</span>
                  <span className="truncate text-muted">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
