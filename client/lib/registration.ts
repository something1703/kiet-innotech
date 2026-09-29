"use client";

import { useSyncExternalStore } from "react";
import { registrationState, type RegistrationState } from "./rules";

const noop = () => () => {};

/** The registration window state, read in the browser. Null during server rendering, so pages don't show a stale state. */
export function useRegistrationState(): RegistrationState | null {
  return useSyncExternalStore(noop, registrationState, () => null);
}
