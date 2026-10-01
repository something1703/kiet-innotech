import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { about, aboutHighlights, event } from "@/lib/content";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";
import { tones } from "./tones";

export function About() {
  const [lead, ...rest] = about.paragraphs;
  return (
    <Section id="about" className="pt-24 sm:pt-32">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading eyebrow="About the event" title={about.title} align="left" />
          <Reveal delay={100}>
            {/* One clear sentence first, then the detail, then the facts as cards. */}
            <p className="text-lg font-medium leading-relaxed text-navy-800 sm:text-xl">{lead}</p>
            {rest.map((paragraph) => (
              <p key={paragraph} className="mt-4 text-base leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {aboutHighlights.map((item) => {
                const tone = tones[item.tone];
                return (
                  <li
                    key={item.title}
                    className="group flex gap-3.5 rounded-2xl border border-line bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:border-transparent hover:shadow-[0_18px_40px_-22px_rgb(11_22_51/0.35)]"
                  >
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110 group-hover:-rotate-6 ${tone.badge}`}>
                      <Icon name={item.icon} className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-sm font-bold text-navy-900">{item.title}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-muted">{item.text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a href="#timeline" className="group inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-600">
                See how it works
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </a>
              <p className="text-sm text-muted">
                Organised by the <span className="font-semibold text-navy-800">{event.organiser}</span>
              </p>
            </div>
          </Reveal>
        </div>

        {/* Photo collage */}
        <Reveal delay={150} className="relative">
          <div className="grid grid-cols-5 grid-rows-[auto_auto] gap-4">
            <div className="relative col-span-5 aspect-[16/9] overflow-hidden rounded-3xl sm:col-span-3 sm:row-span-2 sm:aspect-auto">
              <Image
                src="/images/kiet/ai-skills-lab.jpg"
                alt="Students working in the KIET AI Skills Lab"
                fill
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 60vw, 100vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>
            <div className="relative col-span-5 hidden aspect-[4/3] overflow-hidden rounded-3xl sm:col-span-2 sm:block">
              <Image
                src="/images/kiet/infra-2.webp"
                alt="KIET academic block"
                fill
                sizes="(min-width: 1024px) 20vw, 40vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>
            <div className="relative col-span-5 hidden aspect-[4/3] overflow-hidden rounded-3xl sm:col-span-2 sm:block">
              <Image
                src="/images/kiet/auditorium.webp"
                alt="KIET auditorium during an event"
                fill
                sizes="(min-width: 1024px) 20vw, 40vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>
          </div>
          <div className="absolute -bottom-6 -left-4 hidden rounded-2xl bg-navy-900 px-6 py-4 text-white shadow-xl sm:block">
            <p className="font-display text-3xl font-bold text-brand-400">SDG</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Aligned projects</p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
