/**
 * Unsaved form values, kept in sessionStorage so an expired session (and the trip through /login) never
 * loses a long abstract. Cleared when the form is saved or cancelled. Storage failures are ignored.
 */

const PREFIX = "innotech-draft:";

/** The draft for `key` merged over `fallback`, taking only fields that exist in `fallback` with the same type. */
export function readDraft<T extends object>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    if (!saved || typeof saved !== "object") return fallback;
    const merged: Record<string, unknown> = { ...(fallback as Record<string, unknown>) };
    for (const [field, value] of Object.entries(merged)) {
      const candidate = saved[field];
      if (candidate !== undefined && (typeof candidate === typeof value || value === null || candidate === null)) merged[field] = candidate;
    }
    return merged as T;
  } catch {
    return fallback;
  }
}

export function hasDraft(key: string) {
  try {
    return sessionStorage.getItem(PREFIX + key) !== null;
  } catch {
    return false;
  }
}

export function writeDraft(key: string, value: object) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage is full or blocked; the form still works, the draft just isn't kept.
  }
}

export function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to clear.
  }
}

/** Draft keys include the account, so a different student in the same tab never sees someone else's draft. */
export const draftKeys = {
  profile: (email: string) => `${email.toLowerCase()}:profile`,
  newTeam: (email: string) => `${email.toLowerCase()}:team-new`,
  team: (email: string, teamId: string) => `${email.toLowerCase()}:team-${teamId}`,
};
