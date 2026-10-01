"use client";

import { useEffect, useState } from "react";

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(target: number, now: number): TimeLeft {
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

/**
 * Live countdown to the Grand Finale (`to`), then "happening now" until `endsAt`, then "concluded".
 * Renders placeholders until mounted to avoid hydration mismatch.
 */
export function Countdown({ to, endsAt }: { to: string; endsAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const start = new Date(to).getTime();
  const end = new Date(endsAt).getTime();

  if (now !== null && now >= start) {
    const live = now < end;
    return (
      <div role="status">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">{live ? "Happening now" : "InnoTech26 has concluded"}</p>
        <p className="mt-5 flex items-center gap-3 font-display text-2xl font-bold text-white sm:text-3xl">
          {live && <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-accent-500" aria-hidden="true" />}
          {live ? "The Grand Finale is on at KIET" : "Thank you for being part of it"}
        </p>
        <p className="mt-3 text-sm text-slate-300">
          {live
            ? "Teams are presenting their projects and posters on campus today. Visitors are welcome."
            : "Congratulations to every team, mentor and judge. Results are shared by the organising team."}
        </p>
      </div>
    );
  }

  const timeLeft = now === null ? null : getTimeLeft(start, now);
  const units: { label: string; value?: number }[] = [
    { label: "Days", value: timeLeft?.days },
    { label: "Hours", value: timeLeft?.hours },
    { label: "Minutes", value: timeLeft?.minutes },
    { label: "Seconds", value: timeLeft?.seconds },
  ];

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">Grand Finale begins in</p>
      <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-label="Time left until the Grand Finale">
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
    </div>
  );
}
