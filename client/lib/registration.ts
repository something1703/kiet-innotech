"use client";

import { useSyncExternalStore } from "react";
import { registrationState, type RegistrationState } from "./rules";

// The server's answer from GET /me, once the portal has loaded it. Until then the browser's clock is used.
let serverState: RegistrationState | null = null;
const listeners = new Set<() => void>();

/** Called by the portal with `registration.state` from GET /me. The server is the authority on the window. */
export function setServerRegistrationState(state: RegistrationState | null | undefined) {
  if (!state || state === serverState) return;
  serverState = state;
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function snapshot() {
  return serverState ?? registrationState();
}

/**
 * The registration window state, read in the browser: the server's answer once GET /me has loaded, otherwise
 * the local clock rules (public pages, and the portal before its first load). Null during server rendering,
 * so pages don't show a stale state.
 */
export function useRegistrationState(): RegistrationState | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
