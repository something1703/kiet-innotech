import type { CSSProperties } from "react";
import { benefits } from "@/lib/content";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { tones } from "./tones";

/*
 * Desktop diagram: a title card with the benefit cards around it, each joined to it by a coloured line.
 * Everything is placed on a 1200 x 740 design grid and sized in container units, so the diagram
 * scales as one piece. Smaller screens get a stacked layout instead.
 */
const W = 1200;
const H = 740;
const u = (n: number) => `${(n / W) * 100}cqw`;
const place = (x: number, y: number, w: number, h: number): CSSProperties => ({
  left: `${(x / W) * 100}%`,
  top: `${(y / H) * 100}%`,
  width: `${(w / W) * 100}%`,
  height: `${(h / H) * 100}%`,
});

const TITLE = { x: 40, y: 320, w: 470, h: 170 };

// One entry per benefit, in content order: card box, connector path, and the two dot positions.
const layout = [
  { box: [60, 85, 270, 215], path: "M60 190 H34 Q20 190 20 204 V391 Q20 405 34 405 H40", dots: [[60, 190], [40, 405]] },
  { box: [520, 30, 270, 170], path: "M510 350 H636 Q650 350 650 336 V200", dots: [[510, 350], [650, 200]] },
  { box: [860, 130, 280, 190], path: "M510 378 H986 Q1000 378 1000 364 V320", dots: [[510, 378], [1000, 320]] },
  { box: [110, 530, 240, 195], path: "M80 490 V613 Q80 627 94 627 H110", dots: [[80, 490], [110, 627]] },
  { box: [380, 530, 240, 195], path: "M510 462 H636 Q650 462 650 476 V613 Q650 627 636 627 H620", dots: [[510, 462], [620, 627]] },
  { box: [680, 530, 240, 195], path: "M510 434 H786 Q800 434 800 448 V530", dots: [[510, 434], [800, 530]] },
  { box: [950, 530, 240, 195], path: "M510 406 H1056 Q1070 406 1070 420 V530", dots: [[510, 406], [1070, 530]] },
] as const;

const words = ["Learn", "Connect", "Create", "Make an impact"];

export function Benefits() {
  return (
    <Section id="benefits">
      {/* Desktop: connected diagram */}
      <Reveal className="@container relative mx-auto hidden aspect-[1200/740] w-full max-w-[1200px] xl:block">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true" fill="none">
          {layout.map((item, index) => {
            const stroke = tones[benefits[index].tone].stroke;
            return (
              <g key={index} stroke={stroke} fill={stroke}>
                <path d={item.path} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                {item.dots.map(([cx, cy]) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} stroke="none" />
                ))}
              </g>
            );
          })}
        </svg>

        <div
          className="absolute flex flex-col justify-center rounded-3xl bg-white shadow-[0_20px_50px_-20px_rgb(11_22_51/0.25)] ring-1 ring-line"
          style={{ ...place(TITLE.x, TITLE.y, TITLE.w, TITLE.h), paddingInline: u(44) }}
        >
          <h2 className="font-display font-bold leading-[1.05] tracking-tight text-ink" style={{ fontSize: u(46) }}>
            Participation Benefits
          </h2>
          <Words size={u(12.5)} gap={u(11)} className="mt-[1.4cqw] flex-nowrap whitespace-nowrap" />
        </div>

        {benefits.map((benefit, index) => {
          const [x, y, w, h] = layout[index].box;
          return <BenefitCard key={benefit.title} benefit={benefit} style={place(x, y, w, h)} unit={u} />;
        })}
      </Reveal>

      {/* Phones and tablets: title, then the cards in a grid */}
      <div className="xl:hidden">
        <Reveal className="mx-auto max-w-2xl rounded-3xl bg-white px-6 py-8 text-center shadow-[0_20px_50px_-20px_rgb(11_22_51/0.25)] ring-1 ring-line sm:px-10">
          <h2 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">Participation Benefits</h2>
          <Words size="0.8rem" gap="0.75rem" className="mt-4 justify-center" />
        </Reveal>
        <ul className="mt-14 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <Reveal as="li" key={benefit.title} delay={(index % 3) * 80}>
              <BenefitCard benefit={benefit} unit={(n) => `${n}px`} flow />
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}

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
      className={`${flow ? "relative h-full" : "absolute"} rounded-3xl ${tone.card} shadow-[0_18px_40px_-24px_rgb(11_22_51/0.35)]`}
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
