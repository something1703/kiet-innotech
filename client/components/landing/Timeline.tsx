"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { timeline, type Milestone } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

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

export function Timeline() {
  // Read the visitor's clock on the client only; the server render shows every milestone as upcoming.
  const today = useSyncExternalStore(noSubscription, getTodayInIndia, () => null);

  const statuses = timeline.map((milestone) =>
    today === null ? "upcoming" : getStatus(milestone, today),
  );
  const completed = statuses.filter((status) => status === "done").length;
  const progress = (completed / (timeline.length - 1)) * 100;

  return (
    <Section id="timeline">
      <SectionHeading
        eyebrow="Timeline"
        title="The road to the Grand Finale"
        description="Mark these dates. Registrations close on 12 October 2026."
      />

      <div className="relative">
        {/* Track line: horizontal on desktop, vertical on mobile and tablet */}
        <div className="absolute left-5 top-0 h-full w-1 rounded-full bg-line lg:left-0 lg:top-5 lg:h-1 lg:w-full" aria-hidden="true">
          <div
            className="h-[var(--progress)] w-full rounded-full bg-gradient-to-b from-brand-500 to-accent-500 transition-all duration-1000 lg:h-full lg:w-[var(--progress)] lg:bg-gradient-to-r"
            style={{ "--progress": `${Math.min(progress, 100)}%` } as React.CSSProperties}
          />
        </div>

        <ol className="relative grid gap-10 lg:grid-cols-5 lg:gap-6">
          {timeline.map((milestone, index) => (
            <Reveal as="li" key={milestone.title} delay={index * 100} className="relative pl-16 lg:pl-0 lg:pt-16">
              <MilestoneDot status={statuses[index]} number={index + 1} />
              <p className="text-sm font-bold uppercase tracking-widest text-accent-500">{milestone.dateLabel}</p>
              <h3 className="mt-1 font-display text-xl font-bold text-ink">{milestone.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{milestone.description}</p>
              {statuses[index] === "current" && (
                <span className="mt-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                  Happening now
                </span>
              )}
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function MilestoneDot({ status, number }: { status: Status; number: number }) {
  const styles: Record<Status, string> = {
    done: "border-brand-500 bg-brand-500 text-white",
    current: "animate-pulse-ring border-brand-500 bg-white text-brand-600",
    upcoming: "border-line bg-white text-muted",
  };

  return (
    <span
      className={`absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border-4 font-display text-sm font-bold ${styles[status]}`}
      aria-hidden="true"
    >
      {status === "done" ? <Check size={18} strokeWidth={3} /> : number}
    </span>
  );
}
