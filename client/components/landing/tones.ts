import type { Tone } from "@/lib/content";

/**
 * Pastel colour families for the landing diagrams. Full class strings (not built from parts)
 * so Tailwind can find them; `stroke` colours the SVG connector lines and `wash` tints a white card.
 */
export const tones: Record<Tone, { card: string; badge: string; title: string; stroke: string; wash: string }> = {
  orange: { card: "bg-orange-50 border-orange-100", badge: "bg-orange-100 text-orange-600", title: "text-orange-700", stroke: "#fb923c", wash: "from-orange-50/80" },
  blue: { card: "bg-blue-50 border-blue-100", badge: "bg-blue-100 text-blue-700", title: "text-blue-800", stroke: "#60a5fa", wash: "from-blue-50/80" },
  green: { card: "bg-green-50 border-green-100", badge: "bg-green-100 text-green-700", title: "text-green-800", stroke: "#4ade80", wash: "from-green-50/80" },
  emerald: { card: "bg-emerald-50 border-emerald-100", badge: "bg-emerald-100 text-emerald-700", title: "text-emerald-800", stroke: "#34d399", wash: "from-emerald-50/80" },
  red: { card: "bg-red-50 border-red-100", badge: "bg-red-100 text-red-600", title: "text-red-700", stroke: "#f87171", wash: "from-red-50/80" },
  rose: { card: "bg-rose-50 border-rose-100", badge: "bg-rose-100 text-rose-600", title: "text-rose-800", stroke: "#fb7185", wash: "from-rose-50/80" },
  purple: { card: "bg-violet-50 border-violet-100", badge: "bg-violet-100 text-violet-700", title: "text-violet-800", stroke: "#a78bfa", wash: "from-violet-50/80" },
  indigo: { card: "bg-indigo-50 border-indigo-100", badge: "bg-indigo-100 text-indigo-700", title: "text-indigo-800", stroke: "#818cf8", wash: "from-indigo-50/80" },
  sky: { card: "bg-sky-50 border-sky-100", badge: "bg-sky-100 text-sky-700", title: "text-sky-800", stroke: "#38bdf8", wash: "from-sky-50/80" },
  amber: { card: "bg-amber-50 border-amber-100", badge: "bg-amber-100 text-amber-600", title: "text-amber-800", stroke: "#fbbf24", wash: "from-amber-50/80" },
};
