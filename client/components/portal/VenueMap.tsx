import Image from "next/image";
import { FileText, Map as MapIcon, Maximize2 } from "lucide-react";

/** The organisers' G Block plan (the Grand Finale moved indoors), as one PDF and one picture per page. */
export const VENUE_PDF = "/venue/innotech26-g-block-floor-plans.pdf";

const PAGES = {
  overview: "G Block, floor by floor",
  ground: "Ground floor, Room G-006",
  "floor-1": "Floor 1 corridor",
  "floor-2": "Floor 2 corridor",
  "floor-3": "Floor 3 corridor",
  "floor-4": "Floor 4 corridor",
  "floor-5": "Floor 5 corridor",
} as const;
type Page = keyof typeof PAGES;

/** The plan page that shows a stall: G6-05 is Room G-006, F3-07 Floor 3; the badminton court and others the overview. */
export function venuePage(stall: string | null): Page {
  const match = stall?.toUpperCase().match(/^(G6|F([1-5]))-/);
  if (!match) return "overview";
  return match[1] === "G6" ? "ground" : (`floor-${match[2]}` as Page);
}

/**
 * The venue plan on a student's dashboard: the page with their stall once they are registered (tap for full size), or
 * the floor-by-floor overview, which shows where the Registration Desk is. The whole plan is a PDF.
 */
export function VenueMap({ stall, note }: { stall: string | null; note: string }) {
  const page = venuePage(stall);
  const src = `/venue/${page}.webp`;
  return (
    <section aria-label="Venue plan" className="rounded-3xl bg-white p-4 ring-1 ring-line sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-600">
            <MapIcon size={14} aria-hidden="true" />
            Venue plan · {PAGES[page]}
          </p>
          <p className="mt-1 text-sm text-muted">{note}</p>
        </div>
        <a
          href={VENUE_PDF}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-inset ring-line hover:bg-surface"
        >
          <FileText size={14} aria-hidden="true" />
          All floors (PDF)
        </a>
      </div>
      <a href={src} target="_blank" rel="noopener" className="group relative mt-3 block overflow-hidden rounded-2xl ring-1 ring-line">
        <Image src={src} alt={`Plan of ${PAGES[page]}${stall ? `, with stall ${stall}` : ""}`} width={2000} height={1414} className="h-auto w-full" />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
          <Maximize2 size={12} aria-hidden="true" />
          Tap to zoom
        </span>
      </a>
    </section>
  );
}
