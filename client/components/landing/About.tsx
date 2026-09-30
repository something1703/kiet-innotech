import Image from "next/image";
import { about, event } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

export function About() {
  return (
    <Section id="about" className="pt-24 sm:pt-32">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading eyebrow="About the event" title={about.title} align="left" />
          <Reveal delay={100}>
            {about.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mb-4 text-base leading-relaxed text-muted sm:text-lg">
                {paragraph}
              </p>
            ))}
            <p className="mt-8 text-sm text-muted">
              Organised by the <span className="font-semibold text-navy-800">{event.organiser}</span>
            </p>
          </Reveal>
        </div>

        {/* Photo collage */}
        <Reveal delay={150} className="relative">
          <div className="grid grid-cols-5 grid-rows-[auto_auto] gap-4">
            <div className="relative col-span-5 aspect-[16/9] overflow-hidden rounded-3xl sm:col-span-3 sm:row-span-2 sm:aspect-auto">
              <Image
                src="/images/kiet/ai-skills-lab.webp"
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
