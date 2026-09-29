"use client";

import { useState } from "react";
import { rubrics, type RubricGroup } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

const groups = Object.keys(rubrics) as RubricGroup[];
const MARKS_PER_CRITERION = 10;

export function Judging() {
  const [activeGroup, setActiveGroup] = useState<RubricGroup>("software");
  const rubric = rubrics[activeGroup];

  return (
    <Section id="judging">
      <SectionHeading
        eyebrow="Judging parameters"
        title="Every project is marked out of 50"
        description="Five criteria worth 10 marks each. The same rubric is used at department and institute level."
      />

      <Reveal>
        <div role="tablist" aria-label="Rubric by category" className="mb-8 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:justify-center">
          {groups.map((group) => {
            const isActive = group === activeGroup;
            return (
              <button
                key={group}
                type="button"
                role="tab"
                id={`rubric-tab-${group}`}
                aria-selected={isActive}
                aria-controls="rubric-panel"
                onClick={() => setActiveGroup(group)}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-left transition ${
                  isActive
                    ? "bg-navy-900 text-white shadow-lg shadow-navy-900/20"
                    : "bg-surface text-navy-800 hover:bg-brand-50"
                }`}
              >
                <span className="block text-sm font-bold">{rubrics[group].label}</span>
                <span className={`block text-xs ${isActive ? "text-brand-300" : "text-muted"}`}>
                  {rubrics[group].appliesTo}
                </span>
              </button>
            );
          })}
        </div>

        <div
          id="rubric-panel"
          role="tabpanel"
          aria-labelledby={`rubric-tab-${activeGroup}`}
          className="overflow-hidden rounded-3xl border border-line"
        >
          <ul key={activeGroup} className="divide-y divide-line">
            {rubric.criteria.map((criterion, index) => (
              <li
                key={criterion.title}
                className="grid animate-fade-up gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-display text-sm font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink">{criterion.title}</h3>
                    {criterion.parts && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {criterion.parts.map((part) => (
                          <li key={part} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-navy-800">
                            {part} <span className="text-muted">(5)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <span className="justify-self-start rounded-full bg-accent-50 px-4 py-1.5 text-sm font-bold text-accent-600 sm:justify-self-end">
                  {MARKS_PER_CRITERION} marks
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between bg-navy-900 px-5 py-4 text-white sm:px-6">
            <span className="font-semibold">Total</span>
            <span className="font-display text-xl font-bold">
              {rubric.criteria.length * MARKS_PER_CRITERION} marks
            </span>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
