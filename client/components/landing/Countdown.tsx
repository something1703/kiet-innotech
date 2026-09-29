"use client";

import { useEffect, useState } from "react";

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(target: number): TimeLeft {
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

/** Live countdown to the given ISO date. Renders placeholders until mounted to avoid hydration mismatch. */
export function Countdown({ to }: { to: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const target = new Date(to).getTime();
    const tick = () => setTimeLeft(getTimeLeft(target));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [to]);

  const units: { label: string; value?: number }[] = [
    { label: "Days", value: timeLeft?.days },
    { label: "Hours", value: timeLeft?.hours },
    { label: "Minutes", value: timeLeft?.minutes },
    { label: "Seconds", value: timeLeft?.seconds },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-label="Time left until the Grand Finale">
      {units.map((unit) => (
        <div
          key={unit.label}
          className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center backdrop-blur-sm sm:px-4"
        >
          <div className="font-display text-2xl font-bold tabular-nums text-white sm:text-4xl">
            {unit.value === undefined ? "--" : String(unit.value).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-brand-300 sm:text-xs">
            {unit.label}
          </div>
        </div>
      ))}
    </div>
  );
}
