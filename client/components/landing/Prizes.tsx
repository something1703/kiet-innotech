import { Medal, Trophy } from "lucide-react";
import { departmentPrizes, institutePrizes, prizeDepartments, prizeHeadline, prizePools } from "@/lib/content";
import { formatINR } from "@/lib/format";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Slider } from "@/components/ui/Slider";

export function Prizes() {
  return (
    <Section id="prizes" className="bg-surface">
      <SectionHeading
        eyebrow="Awards and cash prizes"
        title={`Cash prizes worth ${prizeHeadline.cash}`}
        description={`A prize pool of ${prizeHeadline.pool}, with trophies and certificates, awarded at the department round and the Grand Finale.`}
      />

      <LevelHeading title="Institute level" pool={prizePools.institute} note="Grand Finale, amounts per category" />
      <Slider
        label="Institute level prizes"
        gridClassName="md:grid-cols-3 md:gap-5"
        slides={institutePrizes.map((prize, index) => ({
          key: prize.title,
          className: "flex",
          content: (
            <Reveal delay={index * 100} className="flex w-full">
              <div className="group relative h-full w-full overflow-hidden rounded-3xl bg-navy-900 p-7 text-white transition duration-300 hover:-translate-y-1">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/20 blur-2xl transition-transform duration-500 group-hover:scale-150" aria-hidden="true" />
              <Trophy size={32} className="relative text-accent-500" aria-hidden="true" />
              <h4 className="relative mt-4 font-display text-xl font-bold">{prize.title}</h4>
              <p className="relative mt-1 text-sm text-slate-400">{prize.categories}</p>

              <dl className="relative mt-6 grid grid-cols-2 gap-3">
                <PrizeAmount place="1st" amount={prize.first} highlight />
                <PrizeAmount place="2nd" amount={prize.second} />
              </dl>
            </div>
            </Reveal>
          ),
        }))}
      />

      <Reveal className="mt-8 rounded-3xl border border-line bg-white p-6 sm:p-8 md:mt-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-navy-800">
              <Medal size={22} className="text-brand-500" aria-hidden="true" />
              Department level
            </h3>
            <p className="mt-1 text-sm text-muted">
              1st position in every category, awarded in each of the {prizeDepartments.length} departments.
            </p>
            <p className="mt-3 font-display text-2xl font-bold text-accent-600">
              ₹{formatINR(prizePools.department)} <span className="text-sm font-semibold text-muted">prize pool</span>
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            {departmentPrizes.map((prize) => (
              <div key={prize.categories} className="rounded-2xl bg-surface px-5 py-4">
                <dt className="text-sm text-muted">{prize.categories}</dt>
                <dd className="mt-1 font-display text-2xl font-bold text-ink">₹{formatINR(prize.first)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </Section>
  );
}

function LevelHeading({ title, pool, note }: { title: string; pool: number; note: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h3 className="font-display text-lg font-bold text-navy-800">
        {title} <span className="text-sm font-medium text-muted">({note})</span>
      </h3>
      <p className="font-display text-2xl font-bold text-accent-600">
        ₹{formatINR(pool)} <span className="text-sm font-semibold text-muted">prize pool</span>
      </p>
    </div>
  );
}

function PrizeAmount({ place, amount, highlight = false }: { place: string; amount: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${highlight ? "bg-accent-500" : "bg-white/10"}`}>
      <dt className="text-xs font-bold uppercase tracking-widest text-white/80">{place}</dt>
      <dd className="mt-1 font-display text-2xl font-bold">₹{formatINR(amount)}</dd>
    </div>
  );
}
