"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Slide = {
  key: string;
  content: ReactNode;
  /** Extra classes for this slide's <li>, e.g. a grid span on larger screens. */
  className?: string;
};

type SliderProps = {
  /** Accessible name of the list, e.g. "Participation benefits". */
  label: string;
  slides: Slide[];
  /** Layout from the md breakpoint up, where the slider becomes a normal grid, e.g. "md:grid-cols-2 md:gap-5". */
  gridClassName: string;
  /** Width of one slide on phones; the next one peeks in to show there is more. */
  slideWidth?: string;
  /** Top padding of the track on phones; more for badges that stick out above the cards. */
  padTop?: string;
  /** Colours of the dots and arrows: "dark" sits on a navy background. */
  tone?: "light" | "dark";
};

/**
 * On phones: a horizontal, swipeable row of cards with snap points, arrows and dots, so long lists don't need
 * pages of scrolling. From the md breakpoint up the same list is laid out as a grid (`gridClassName`).
 */
export function Slider({ label, slides, gridClassName, slideWidth = "w-[84%] sm:w-[62%]", padTop = "pt-4", tone = "light" }: SliderProps) {
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const frame = useRef(0);

  const offset = (element: HTMLElement) => element.offsetLeft - parseFloat(getComputedStyle(track.current!).paddingLeft);

  const updateActive = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = track.current;
      if (!el) return;
      const items = Array.from(el.children) as HTMLElement[];
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        // The last slides can't reach the snap position at the start of the track.
        setActive(items.length - 1);
        return;
      }
      let nearest = 0;
      items.forEach((item, index) => {
        if (Math.abs(offset(item) - el.scrollLeft) < Math.abs(offset(items[nearest]) - el.scrollLeft)) nearest = index;
      });
      setActive(nearest);
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    return () => {
      el.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
      cancelAnimationFrame(frame.current);
    };
  }, [updateActive]);

  const goTo = (index: number) => {
    const el = track.current;
    const item = el?.children[Math.max(0, Math.min(index, slides.length - 1))] as HTMLElement | undefined;
    if (!el || !item) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: offset(item), behavior: smooth ? "smooth" : "auto" });
  };

  const dark = tone === "dark";
  const arrow = `flex h-10 w-10 items-center justify-center rounded-full transition disabled:opacity-30 ${
    dark ? "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20" : "bg-white text-navy-900 shadow-sm ring-1 ring-line hover:ring-navy-800/30"
  }`;

  return (
    <div>
      {/* The scrolling track clips anything outside it, so it gets room for badges above and shadows below. */}
      <ul
        ref={track}
        aria-label={label}
        className={`slider-track relative -mx-4 -mb-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-10 ${padTop} [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:mb-0 md:grid md:snap-none md:overflow-visible md:px-0 md:py-0 [&::-webkit-scrollbar]:hidden ${gridClassName}`}
      >
        {slides.map((slide) => (
          <li key={slide.key} className={`${slideWidth} shrink-0 snap-start md:w-auto ${slide.className ?? ""}`}>
            {slide.content}
          </li>
        ))}
      </ul>

      {slides.length > 1 && (
        <div className="mt-3 flex items-center justify-between gap-4 md:hidden">
          <button type="button" className={arrow} onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {slides.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show ${index + 1} of ${slides.length}`}
                aria-current={index === active}
                className={`h-2 rounded-full transition-all ${
                  index === active ? `w-6 ${dark ? "bg-brand-300" : "bg-navy-900"}` : `w-2 ${dark ? "bg-white/25" : "bg-navy-900/20"}`
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            className={arrow}
            onClick={() => goTo(active + 1)}
            disabled={active === slides.length - 1}
            aria-label="Next"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
