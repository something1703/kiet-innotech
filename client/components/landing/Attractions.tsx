import { attractions } from "@/lib/content";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

export function Attractions() {
  return (
    <Section id="attractions">
      <SectionHeading
        eyebrow="Special attractions"
        title="More than a competition"
        description="On finale day the campus turns into an innovation exhibition."
      />
      <ul className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {attractions.map((item, index) => (
          <Reveal as="li" key={item.title} delay={(index % 3) * 80} className="bg-white">
            <div className="group flex h-full gap-5 p-6 transition-colors hover:bg-surface sm:p-8">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-500 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <Icon name={item.icon} size={24} />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-ink">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.text}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
