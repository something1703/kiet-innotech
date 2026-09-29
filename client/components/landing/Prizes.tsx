import { Medal, Trophy } from "lucide-react";
import { departmentPrizes, departments, institutePrizes } from "@/lib/content";
import { formatINR } from "@/lib/format";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

export function Prizes() {
  return (
    <Section id="prizes" className="bg-surface">
      <SectionHeading
        eyebrow="Awards and cash prizes"
        title="Prizes worth ₹3.38 lakh"
        description="Winners at the institute level receive cash prizes, trophies and certificates. Department winners are awarded in every department."
      />

      <h3 className="mb-6 font-display text-lg font-bold text-navy-800">Institute level</h3>
      <ul className="grid gap-5 md:grid-cols-3">
        {institutePrizes.map((prize, index) => (
          <Reveal as="li" key={prize.title} delay={index * 100}>
            <div className="group relative h-full overflow-hidden rounded-3xl bg-navy-900 p-7 text-white transition duration-300 hover:-translate-y-1">
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
        ))}
      </ul>

      <Reveal className="mt-12 rounded-3xl border border-line bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-navy-800">
              <Medal size={22} className="text-brand-500" aria-hidden="true" />
              Department level (1st position)
            </h3>
            <p className="mt-1 text-sm text-muted">Awarded in each of the {departments.length} departments.</p>
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
        <ul className="mt-6 flex flex-wrap gap-2 border-t border-line pt-6" aria-label="Participating departments">
          {departments.map((department) => (
            <li key={department} className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-navy-800">
              {department}
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
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
