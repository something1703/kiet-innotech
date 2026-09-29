import { liveUpdates } from "@/lib/content";

/** Scrolling news ticker shown under the header. */
export function LiveUpdates() {
  // The list is rendered twice so the marquee can loop seamlessly.
  const items = [...liveUpdates, ...liveUpdates];

  return (
    <div className="flex items-stretch overflow-hidden bg-navy-900 text-white">
      <div className="relative z-10 flex shrink-0 items-center gap-2 bg-accent-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wider sm:px-6 sm:text-sm">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Live Updates
      </div>
      <div className="group flex min-w-0 flex-1 items-center overflow-hidden">
        <ul className="flex w-max animate-marquee items-center group-hover:[animation-play-state:paused]">
          {items.map((item, index) => (
            <li
              key={index}
              aria-hidden={index >= liveUpdates.length}
              className="flex items-center whitespace-nowrap px-6 text-sm font-medium text-slate-200"
            >
              <span className="mr-6 h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
