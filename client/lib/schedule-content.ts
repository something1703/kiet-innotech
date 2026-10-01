"use client";

import { liveUpdates, timeline, type Milestone } from "./content";
import { dateRange, formatDate, istDay, longDate } from "./format";
import { useRegistrationDates, useRegistrationState } from "./registration";

/** The planned timeline with the two registration milestones following the dates organisers have set. */
export function useTimeline(): Milestone[] {
  const { opens, closes } = useRegistrationDates();
  return timeline.map((milestone, index) => {
    if (index === 0) return { ...milestone, dateLabel: formatDate(opens), start: istDay(opens), end: istDay(opens) };
    if (index === 1) return { ...milestone, dateLabel: formatDate(closes), start: istDay(closes), end: istDay(closes) };
    return milestone;
  });
}

/** "3 - 12 Oct 2026" */
export function useRegistrationRange(): string {
  const { opens, closes } = useRegistrationDates();
  return dateRange(opens, closes);
}

/** One sentence about where registration stands, e.g. "Registration open until 12 October 2026". */
export function useRegistrationSentence(): string {
  const { opens, closes } = useRegistrationDates();
  const state = useRegistrationState() ?? "open";
  if (state === "upcoming") return `Registration opens on ${longDate(opens)}`;
  if (state === "closed") return `Registration closed on ${longDate(closes)}`;
  return `Registration open until ${longDate(closes)}`;
}

/** The ticker, with its first line following the live registration window. */
export function useLiveUpdates(): string[] {
  const sentence = useRegistrationSentence();
  return liveUpdates.map((item, index) => (index === 0 ? sentence.replace("Registration open until", "Registrations are open until").replace("Registration opens on", "Registrations open on") : item));
}
