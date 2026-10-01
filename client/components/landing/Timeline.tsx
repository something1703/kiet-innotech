"use client";

import { useSyncExternalStore, type ComponentType } from "react";
import { ClipboardCheck, ClipboardPen, Lock, Megaphone, Trophy, type LucideProps } from "lucide-react";
import { event, timeline, type Milestone } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";

type Status = "done" | "current" | "upcoming";

// Milestone dates are ISO days ("2026-10-12"), so plain string comparison orders them correctly.
function getStatus(milestone: Milestone, today: string): Status {
  if (today > milestone.end) return "done";
  if (today >= milestone.start) return "current";
  return "upcoming";
}

/** Today's date in IST as "YYYY-MM-DD". */
function getTodayInIndia() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const noSubscription = () => () => {};

/** One colour and icon per milestone, in timeline order. Full class strings so Tailwind can find them. */
const stages: { icon: ComponentType<LucideProps>; text: string; bg: string; border: string }[] = [
  { icon: ClipboardPen, text: "text-orange-500", bg: "bg-orange-500", border: "border-orange-500" },
  { icon: Lock, text: "text-amber-500", bg: "bg-amber-500", border: "border-amber-500" },
  { icon: ClipboardCheck, text: "text-green-500", bg: "bg-green-500", border: "border-green-500" },
  { icon: Megaphone, text: "text-cyan-500", bg: "bg-cyan-500", border: "border-cyan-500" },
  { icon: Trophy, text: "text-violet-600", bg: "bg-violet-600", border: "border-violet-600" },
];

const number = (index: number) => String(index + 1).padStart(2, "0");

export function Timeline() {
  // Read the visitor's clock on the client only; the server render shows every milestone as upcoming.
  const today = useSyncExternalStore(noSubscription, getTodayInIndia, () => null);
  const statuses = timeline.map((milestone) => (today === null ? "upcoming" : getStatus(milestone, today)));

  return (
    <Section id="timeline" className="bg-[#fdfcfb]">
      <Reveal className="mb-14 text-center lg:mb-10">
        <h2 className="font-display text-6xl font-black uppercase tracking-tight text-navy-900 sm:text-7xl lg:text-8xl">Timeline</h2>
        <p className="mt-2 font-display text-base font-bold uppercase tracking-wide text-ink sm:text-xl lg:text-2xl">
          Of the {event.name} journey to the Grand Finale
        </p>
      </Reveal>

      {/* Desktop: horizontal line, icons alternating above and below */}
      <ol className="hidden grid-cols-5 lg:grid">
        {timeline.map((milestone, index) => {
          const iconAbove = index % 2 === 1;
          return (
            <Reveal as="li" key={milestone.title} delay={index * 100} className="grid grid-rows-[15rem_0.75rem_15rem]">
              <div className="flex flex-col justify-end">
                {iconAbove ? <IconStem index={index} above /> : <StageText milestone={milestone} index={index} status={statuses[index]} className="pb-7" />}
              </div>
              <div className={`relative ${stages[index].bg}`}>
                <span
                  className={`absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] ${stages[index].border} ${
                    statuses[index] === "upcoming" ? "bg-white" : stages[index].bg
                  }`}
                  aria-hidden="true"
                />
              </div>
              <div className="flex flex-col">
                {iconAbove ? <StageText milestone={milestone} index={index} status={statuses[index]} className="pt-7" /> : <IconStem index={index} />}
              </div>
            </Reveal>
          );
        })}
      </ol>

      {/* Phones and tablets: vertical line */}
      <ol className="mx-auto max-w-xl lg:hidden">
        {timeline.map((milestone, index) => {
          const Stage = stages[index].icon;
          return (
            <Reveal as="li" key={milestone.title} delay={index * 80} className="flex gap-5">
              <div className="flex flex-col items-center">
                <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[7px] bg-white ${stages[index].border}`}>
                  <Stage size={24} className="text-navy-900" aria-hidden="true" />
                </span>
                {index < timeline.length - 1 && <span className={`w-1.5 flex-1 ${stages[index].bg}`} aria-hidden="true" />}
              </div>
              <StageText milestone={milestone} index={index} status={statuses[index]} className="pb-10 pt-2 text-left" />
            </Reveal>
          );
        })}
      </ol>
    </Section>
  );
}

/** The big ring icon on a stem, with the stage number beside the stem. */
function IconStem({ index, above = false }: { index: number; above?: boolean }) {
  const stage = stages[index];
  const Stage = stage.icon;
  const ring = (
    <span className={`flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-[16px] bg-white shadow-[0_12px_30px_-12px_rgb(11_22_51/0.35)] ${stage.border}`}>
      <Stage size={44} strokeWidth={2.25} className="text-navy-900" aria-hidden="true" />
    </span>
  );
  const stem = (
    <span className="relative w-2.5 flex-1">
      <span className={`absolute inset-0 ${stage.bg}`} />
      <span className={`absolute left-6 top-1/2 -translate-y-1/2 font-display text-4xl font-black ${stage.text}`} aria-hidden="true">
        {number(index)}
      </span>
    </span>
  );
  return (
    <div className="flex h-full flex-col items-center" aria-hidden="true">
      {above ? (
        <>
          {ring}
          {stem}
        </>
      ) : (
        <>
          {stem}
          {ring}
        </>
      )}
    </div>
  );
}

function StageText({ milestone, index, status, className = "" }: { milestone: Milestone; index: number; status: Status; className?: string }) {
  return (
    <div className={`px-3 text-center ${className}`}>
      <h3 className="font-display text-xl font-black uppercase leading-tight text-navy-900">
        <span className={stages[index].text}>{number(index)}</span> {milestone.title}
      </h3>
      <p className="mt-1.5 text-sm font-bold text-ink">{milestone.dateLabel}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{milestone.description}</p>
      {status === "current" && (
        <span className="mt-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">Happening now</span>
      )}
    </div>
  );
}
