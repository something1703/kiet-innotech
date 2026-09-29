"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { faqs } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions"
            description="Cannot find your answer? Visit the help desk on campus or contact the organising team."
            align="left"
          />
        </div>

        <Reveal>
          <ul className="divide-y divide-line rounded-3xl border border-line">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              const panelId = `faq-panel-${index}`;
              return (
                <li key={faq.question}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left font-semibold text-ink transition-colors hover:text-brand-600 sm:px-6"
                    >
                      {faq.question}
                      <Plus
                        size={20}
                        aria-hidden="true"
                        className={`shrink-0 text-brand-500 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                      />
                    </button>
                  </h3>
                  {/* grid-rows trick animates height between 0 and auto */}
                  <div
                    id={panelId}
                    className={`grid transition-[grid-template-rows] duration-300 ${
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-muted sm:px-6 sm:text-base">{faq.answer}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
