import {
  Award,
  Building2,
  Code2,
  Cpu,
  Lightbulb,
  Rocket,
  ShieldCheck,
  Trophy,
  Users,
  Vote,
  type LucideProps,
} from "lucide-react";

/** Maps the icon names used in lib/content.ts to lucide components. */
const icons = {
  award: Award,
  building: Building2,
  code: Code2,
  cpu: Cpu,
  lightbulb: Lightbulb,
  rocket: Rocket,
  shield: ShieldCheck,
  trophy: Trophy,
  users: Users,
  vote: Vote,
};

export type IconName = keyof typeof icons;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const Component = icons[name];
  return <Component aria-hidden="true" {...props} />;
}
