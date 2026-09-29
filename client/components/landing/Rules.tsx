import { Info, ListChecks } from "lucide-react";
import { registrationSteps, selectionNotes, teamRules } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

export function Rules() {
  return (
    <Section id="rules" className="bg-surface">
      <SectionHeading
        eyebrow="Registration and rules"
        title="How to register your team"
        description="Every student registers first. The team leader then builds the team from their own account."
      />

      {/* Registration steps */}
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {registrationSteps.map((step, index) => (
          <Reveal as="li" key={step.title} delay={index * 100}>
            <div className="relative h-full rounded-3xl bg-white p-6 ring-1 ring-line">
              <span className="font-display text-sm font-bold text-accent-500">Step {index + 1}</span>
              <h3 className="mt-2 font-display text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
            </div>
          </Reveal>
        ))}
      </ol>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8">
          <h3 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
            <ListChecks size={22} className="text-brand-500" aria-hidden="true" />
            Rules for a team
          </h3>
          <ul className="mt-6 space-y-4">
            {teamRules.map((rule, index) => (
              <li key={rule} className="flex gap-4 text-sm leading-relaxed text-navy-800 sm:text-base">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                  {index + 1}
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="rounded-3xl bg-navy-900 p-6 text-white sm:p-8">
          <h3 className="flex items-center gap-2 font-display text-xl font-bold">
            <Info size={22} className="text-brand-400" aria-hidden="true" />
            Finalist selection
          </h3>
          <ul className="mt-6 space-y-4">
            {selectionNotes.map((note) => (
              <li key={note} className="flex gap-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden="true" />
                {note}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
