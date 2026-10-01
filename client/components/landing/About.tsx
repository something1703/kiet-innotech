import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { about, benefits, domains, event } from "@/lib/content";
import { Icon } from "@/components/ui/Icon";
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
            <ul className="mt-6 space-y-3">
              {about.highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 font-medium text-navy-800">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
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

      {/* Participation benefits */}
      <div className="mt-24">
        <SectionHeading
          eyebrow="Why participate"
          title="Learn, connect, create and make an impact"
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <Reveal as="li" key={benefit.title} delay={index * 80}>
              <div className="group h-full rounded-3xl border border-line bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_20px_40px_-20px_rgb(22_169_221/0.45)]">
                <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <Icon name={benefit.icon} size={24} />
                </span>
                <h3 className="font-display text-lg font-bold text-ink">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{benefit.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>

      {/* Focus domains */}
      <div className="mt-24">
        <SectionHeading
          eyebrow="Focus domains"
          title="Build in the areas that shape the future"
          description="Students can follow these domains, but ideas are not limited to them."
        />
        <Reveal>
          <ul className="flex flex-wrap justify-center gap-3">
            {domains.map((domain) => (
              <li
                key={domain}
                className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-navy-800 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
              >
                {domain}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
