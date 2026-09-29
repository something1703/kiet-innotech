import { coreTeam } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

/** "Dr. Kamal Kant Sharma" -> "KS" (first and last name, ignoring the title). */
function initials(name: string) {
  const parts = name.replace(/^(Dr|Mr|Ms|Mrs)\.\s*/, "").split(" ");
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

export function CoreTeam() {
  return (
    <Section id="team" className="bg-surface">
      <SectionHeading
        eyebrow="Core team"
        title="The people behind InnoTech'26"
        description="Faculty coordinators from the Department of IT & CSE (Cyber Security)."
      />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {coreTeam.map((member, index) => (
          <Reveal as="li" key={member.name} delay={(index % 3) * 80}>
            <div className="group flex items-center gap-4 rounded-3xl border border-line p-5 transition duration-300 hover:border-brand-300 hover:shadow-[0_16px_40px_-20px_rgb(22_169_221/0.5)]">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-800 to-brand-600 font-display text-lg font-bold text-white transition-transform duration-300 group-hover:scale-105">
                {initials(member.name)}
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-ink">{member.name}</h3>
                <p className="text-sm text-muted">{member.role}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
