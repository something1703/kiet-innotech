/**
 * Someone who came from the Startups page to register a startup: remembered for this browser tab, so the
 * profile form opens on its Startup side after they have signed in with Google.
 */
export const STARTUP_INTENT_KEY = "innotech-register-as";

export function rememberStartupIntent() {
  try {
    sessionStorage.setItem(STARTUP_INTENT_KEY, "startup");
  } catch {
    // Storage blocked: they can still slide to Startup themselves.
  }
}

export function hasStartupIntent() {
  try {
    return sessionStorage.getItem(STARTUP_INTENT_KEY) === "startup";
  } catch {
    return false;
  }
}

/** Forgotten once the profile is saved, so it never affects a later visit. */
export function clearStartupIntent() {
  try {
    sessionStorage.removeItem(STARTUP_INTENT_KEY);
  } catch {
    // Nothing to clear.
  }
}
