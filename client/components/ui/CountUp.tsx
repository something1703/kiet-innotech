"use client";

import { useEffect, useRef, useState } from "react";

type CountUpProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  /** "lakh" shows 338000 as "3.38L" and 500000 as "5L". */
  format?: "plain" | "lakh";
  duration?: number;
};

function display(value: number, format: CountUpProps["format"]) {
  if (format === "lakh") return `${Number((value / 100_000).toFixed(2))}L`;
  return Math.round(value).toLocaleString("en-IN");
}

/** Animates a number from 0 to `value` when it first scrolls into view. */
export function CountUp({ value, prefix = "", suffix = "", format = "plain", duration = 1600 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();

      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(value * eased);
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} aria-label={`${prefix}${display(value, format)}${suffix}`}>
      {prefix}
      {display(current, format)}
      {suffix}
    </span>
  );
}
