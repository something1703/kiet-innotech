"use client";

import { useSyncExternalStore } from "react";
import { send } from "./api/http";
import { apiMode } from "./auth/session";
import { REGISTRATION_CLOSES, REGISTRATION_OPENS, registrationState, type RegistrationState } from "./rules";
import type { RegistrationWindow } from "./types";

/*
 * The registration window is controlled by organisers (Schedule page in the admin panel), so the pages never
 * trust dates baked in at build time. The server's answer comes from GET /me (signed in) or GET /config (public
 * pages) and is what everything below reads. Until it arrives, and in the demo mode, the planned dates and the
 * browser's clock are used.
 */
let server: RegistrationWindow | null = null;
const listeners = new Set<() => void>();

/** Called with the window from GET /me or GET /config. The server is the authority on it. */
export function setServerRegistration(next: RegistrationWindow | null | undefined) {
  if (!next || (server && server.state === next.state && server.opens === next.opens && server.closes === next.closes)) return;
  server = next;
  listeners.forEach((listener) => listener());
}

const REFRESH_AFTER_MS = 30_000;
let lastFetch = 0;
let wired = false;

/** Fetches GET /config (no sign-in needed), at most every 30 seconds. A failure just keeps what is known. */
export async function refreshRegistration() {
  if (apiMode !== "live" || typeof window === "undefined" || Date.now() - lastFetch < REFRESH_AFTER_MS) return;
  lastFetch = Date.now();
  try {
    const config = (await send("GET", "/config")) as { registration?: RegistrationWindow } | undefined;
    setServerRegistration(config?.registration);
  } catch {
    // Offline or the server is busy: the planned dates stay in place.
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!wired && typeof document !== "undefined") {
    wired = true;
    // A page left open picks up an organiser's change when the visitor comes back to it.
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void refreshRegistration());
  }
  void refreshRegistration();
  return () => {
    listeners.delete(onChange);
  };
}

const windowSnapshot = () => server;
const stateSnapshot = () => server?.state ?? registrationState();

/**
 * The registration state: the server's answer once known, otherwise the planned dates against the browser's clock.
 * Null while rendering on the server, so pages never show a stale state.
 */
export function useRegistrationState(): RegistrationState | null {
  return useSyncExternalStore(subscribe, stateSnapshot, () => null);
}

/** The opening and closing moments: the server's, or the planned ones until it answers. Same on the server and first paint. */
export function useRegistrationDates(): { opens: string; closes: string } {
  const known = useSyncExternalStore(subscribe, windowSnapshot, () => null);
  return known ?? { opens: REGISTRATION_OPENS, closes: REGISTRATION_CLOSES };
}
