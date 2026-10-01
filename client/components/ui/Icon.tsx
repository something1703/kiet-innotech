import {
  Award,
  Bot,
  Boxes,
  Briefcase,
  Building2,
  Cloud,
  Code2,
  Cog,
  Cpu,
  Flag,
  Glasses,
  HeartPulse,
  IndianRupee,
  Leaf,
  Lightbulb,
  Rocket,
  Share2,
  Shield,
  ShieldCheck,
  Sprout,
  Star,
  Trophy,
  Users,
  Vote,
  type LucideProps,
} from "lucide-react";

/** Maps the icon names used in lib/content.ts to lucide components. */
const icons = {
  award: Award,
  bot: Bot,
  boxes: Boxes,
  briefcase: Briefcase,
  building: Building2,
  city: Building2,
  cloud: Cloud,
  code: Code2,
  cog: Cog,
  cpu: Cpu,
  flag: Flag,
  glasses: Glasses,
  heart: HeartPulse,
  leaf: Leaf,
  lightbulb: Lightbulb,
  rocket: Rocket,
  rupee: IndianRupee,
  share: Share2,
  shield: ShieldCheck,
  shieldOutline: Shield,
  sprout: Sprout,
  star: Star,
  trophy: Trophy,
  users: Users,
  vote: Vote,
};

export type IconName = keyof typeof icons;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const Component = icons[name];
  return <Component aria-hidden="true" {...props} />;
}
