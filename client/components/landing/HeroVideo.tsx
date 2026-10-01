"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's background film: InnoTech'25 in 24 seconds, silent and looping (made from last year's photos).
 * It plays only while the hero is on screen and the tab is visible. With reduced motion or data saver
 * turned on, the still poster stays instead, and nothing is downloaded.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reducedMotion || saveData) return;

    let onScreen = false;
    const update = () => {
      if (onScreen && document.visibilityState === "visible") {
        // Autoplay can still be refused (e.g. low-power mode); the poster then simply stays.
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    observer.observe(video);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      poster="/video/hero-poster.webp"
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
      className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
    >
      <source src="/video/hero.webm" type="video/webm" />
      <source src="/video/hero.mp4" type="video/mp4" />
    </video>
  );
}
