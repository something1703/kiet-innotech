import type { CSSProperties } from "react";
import { benefits, departmentPrizes, institutePrizes } from "@/lib/content";
import { CountUp } from "@/components/ui/CountUp";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { Slider } from "@/components/ui/Slider";
import { tones } from "./tones";

const words = ["Learn", "Connect", "Create", "Make an impact"];

type Benefit = (typeof benefits)[number];
const byTitle = (title: string) => benefits.find((b) => b.title === title)!;

/*
 * Desktop: a bento layout. A dark title card sits beside the prize pool (the biggest draw, with its number counting up),
 * and the other benefits are tidy cards of equal weight. Phones and tablets get the title card and a slider/grid instead.
 */
export function Benefits() {
  const prize = byTitle("Prize Pool");
  const [career, motto, solving, networking, recognition, confidence] = [
    byTitle("Career & Entrepreneurship"),
    byTitle("InnoTech Motto"),
    byTitle("Problem-Solving"),
    byTitle("Networking"),
    byTitle("Recognition"),
    byTitle("Confidence"),
  ];

  return (
    <Section id="benefits">
      {/* Desktop: bento */}
      <div className="mx-auto hidden max-w-[1200px] grid-cols-12 gap-5 xl:grid">
        <Reveal className="relative col-span-4 row-span-2 overflow-hidden rounded-3xl bg-navy-900 p-9 text-white shadow-[0_30px_70px_-30px_rgb(11_22_51/0.6)]">
          <div className="bg-grid absolute inset-0" aria-hidden="true" />
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-accent-500/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex h-full flex-col">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-300">
              <span className="h-px w-6 bg-current" />
              Why take part
            </p>
            <h2 className="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-tight">Participation Benefits</h2>
            <p className="mt-4 max-w-xs text-base leading-relaxed text-slate-300">Seven reasons to bring your idea to InnoTech26.</p>
            <ul className="mt-auto space-y-3 pt-10">
              {words.map((word, index) => (
                <li key={word} className="group flex items-center gap-4">
                  <span className="flex size-9 items-center justify-center rounded-full bg-white/10 font-display text-sm font-bold text-brand-300 ring-1 ring-white/15 transition group-hover:bg-accent-500 group-hover:text-white">
                    {index + 1}
                  </span>
                  <span className="font-display text-xl font-bold uppercase tracking-wide text-white">{word}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/25 to-transparent" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <PrizeCard benefit={prize} />
        <BentoCard benefit={career} delay={100} className="col-span-4" />
        <BentoCard benefit={solving} delay={160} className="col-span-4" />
        <BentoCard benefit={motto} delay={120} className="col-span-3" />
        <BentoCard benefit={networking} delay={180} className="col-span-3" />
        <BentoCard benefit={recognition} delay={240} className="col-span-3" />
        <BentoCard benefit={confidence} delay={300} className="col-span-3" />
      </div>

      {/* Phones and tablets: title, then the cards in a grid */}
      <div className="xl:hidden">
        <Reveal className="mx-auto max-w-2xl rounded-3xl bg-white px-6 py-8 text-center shadow-[0_20px_50px_-20px_rgb(11_22_51/0.25)] ring-1 ring-line sm:px-10">
          <h2 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">Participation Benefits</h2>
          <Words size="0.8rem" gap="0.75rem" className="mt-4 justify-center" />
        </Reveal>
        {/* Phones: a slider (the badges stick out above the cards, hence the extra top padding). Tablets: a grid. */}
        <div className="mt-8 md:mt-14">
          <Slider
            label="Participation benefits"
            padTop="pt-10"
            gridClassName="md:grid-cols-2 md:gap-x-5 md:gap-y-12 lg:grid-cols-3"
            slides={benefits.map((benefit, index) => ({
              key: benefit.title,
              className: "flex",
              content: (
                <Reveal delay={(index % 3) * 80} className="flex w-full">
                  <BenefitCard benefit={benefit} unit={(n) => `${n}px`} flow />
                </Reveal>
              ),
            }))}
          />
        </div>
      </div>
    </Section>
  );
}

/** A desktop card: icon badge, title and text, lifting slightly on hover. */
function BentoCard({ benefit, delay, className = "" }: { benefit: Benefit; delay: number; className?: string }) {
  const tone = tones[benefit.tone];
  return (
    <Reveal delay={delay} className={`group relative overflow-hidden rounded-3xl border ${tone.card} p-7 shadow-[0_18px_40px_-26px_rgb(11_22_51/0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgb(11_22_51/0.4)] ${className}`}>
      <span className={`flex size-14 items-center justify-center rounded-2xl ring-4 ring-white transition duration-300 group-hover:scale-110 group-hover:-rotate-6 ${tone.badge}`}>
        <Icon name={benefit.icon} className="size-7" />
      </span>
      <h3 className={`mt-5 font-display text-lg font-extrabold uppercase leading-tight tracking-wide ${tone.title}`}>{benefit.title}</h3>
      <p className="mt-2 text-[15px] leading-normal text-navy-800">{benefit.text}</p>
    </Reveal>
  );
}

/** The prize pool, wider than the rest, with the headline amount counting up. */
function PrizeCard({ benefit }: { benefit: Benefit }) {
  const tone = tones[benefit.tone];
  return (
    <Reveal delay={60} className={`group relative col-span-8 overflow-hidden rounded-3xl border ${tone.card} p-8 shadow-[0_18px_40px_-26px_rgb(11_22_51/0.35)]`}>
      <div className="absolute -right-10 -top-10 size-52 rounded-full bg-emerald-200/50 blur-3xl" aria-hidden="true" />
      <div className="relative flex items-center gap-8">
        <span className={`flex size-20 shrink-0 items-center justify-center rounded-3xl ring-4 ring-white transition duration-300 group-hover:scale-105 ${tone.badge}`}>
          <Icon name={benefit.icon} className="size-10" />
        </span>
        <div className="min-w-0">
          <h3 className={`font-display text-lg font-extrabold uppercase tracking-wide ${tone.title}`}>{benefit.title}</h3>
          <p className="mt-1 font-display text-6xl font-extrabold leading-none tracking-tight text-navy-900">
            <CountUp value={5} prefix="₹" suffix=" lakh+" />
          </p>
          <p className="mt-3 text-[15px] leading-normal text-navy-800">{benefit.text}</p>
        </div>
        <dl className="ml-auto w-80 shrink-0 divide-y divide-emerald-200/70 self-stretch rounded-2xl bg-white/70 px-5 py-1 ring-1 ring-emerald-100">
          {[...institutePrizes.map((p) => ({ label: p.title, value: `${money(p.first)} / ${money(p.second)}` })), { label: "Each department, 1st place", value: money(departmentPrizes[0].first) }].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <dt className="text-navy-800">{row.label}</dt>
              <dd className="whitespace-nowrap font-display font-bold tabular-nums text-emerald-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Reveal>
  );
}

const money = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

function Words({ size, gap, className = "" }: { size: string; gap: string; className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center font-bold uppercase tracking-[0.08em] text-navy-800 ${className}`} style={{ fontSize: size, columnGap: gap }}>
      {words.map((word, index) => (
        <li key={word} className="flex items-center" style={{ columnGap: gap }}>
          {index > 0 && <span className="h-[1em] w-px bg-line" aria-hidden="true" />}
          {word}
        </li>
      ))}
    </ul>
  );
}

type BenefitCardProps = {
  benefit: (typeof benefits)[number];
  unit: (n: number) => string;
  style?: CSSProperties;
  /** In the stacked layout the card sits in the page flow instead of on the diagram. */
  flow?: boolean;
};

function BenefitCard({ benefit, unit, style, flow = false }: BenefitCardProps) {
  const tone = tones[benefit.tone];
  return (
    <div
      className={`${flow ? "relative h-full w-full" : "absolute"} rounded-3xl ${tone.card} shadow-[0_18px_40px_-24px_rgb(11_22_51/0.35)]`}
      style={{ ...style, padding: `${unit(42)} ${unit(24)} ${unit(20)}` }}
    >
      <span
        className={`absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full ring-4 ring-white ${tone.badge}`}
        style={{ top: unit(-29), width: unit(58), height: unit(58) }}
      >
        <Icon name={benefit.icon} style={{ width: unit(26), height: unit(26) }} />
      </span>
      <h3 className={`font-display font-extrabold uppercase leading-tight tracking-wide ${tone.title}`} style={{ fontSize: unit(17) }}>
        {benefit.title}
      </h3>
      <p className="mt-[0.5em] leading-normal text-navy-800" style={{ fontSize: unit(15) }}>
        {benefit.text}
      </p>
    </div>
  );
}
