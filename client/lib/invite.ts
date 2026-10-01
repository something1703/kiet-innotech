/**
 * Team invites that students share themselves (WhatsApp, email, any app), since the portal sends no email.
 *
 * The invite carries a join link, /join/?code=K7PQ-3XM9. Opening it remembers the code in this browser, so it
 * survives signing in and completing the profile, and the "Join with a team code" form is then filled in.
 */
import { REGISTRATION_CLOSES, normaliseJoinCode } from "./rules";
import type { Team } from "./types";

const PENDING_KEY = "innotech-join-code";
// An invite link opened a week ago is stale; don't keep offering it.
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function savePendingJoinCode(code: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ code, savedAt: Date.now() }));
  } catch {
    // Storage blocked (private mode): the student can still type the code.
  }
}

/** The code from an invite link this browser opened recently, or null. */
export function pendingJoinCode(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const { code, savedAt } = JSON.parse(raw) as { code?: unknown; savedAt?: unknown };
    const valid = typeof code === "string" ? normaliseJoinCode(code) : null;
    if (valid && typeof savedAt === "number" && Date.now() - savedAt < PENDING_MAX_AGE_MS) return valid;
  } catch {
    // Malformed or blocked: treat as no invite.
  }
  clearPendingJoinCode();
  return null;
}

export function clearPendingJoinCode() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The link a teammate opens to join; it points at whichever address the portal is served from. */
export function joinLink(code: string) {
  return `${window.location.origin}/join/?code=${encodeURIComponent(code)}`;
}

const closesOn = () =>
  new Date(REGISTRATION_CLOSES).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });

/** The invite text. Without `link` it is meant for share sheets, which attach the link themselves. */
export function inviteMessage(team: Pick<Team, "name" | "joinCode">, link?: string) {
  return [
    `Join my team "${team.name}" for InnoTech26 at KIET!`,
    "",
    `Team code: ${team.joinCode}`,
    ...(link ? [`Join here: ${link}`] : []),
    "",
    `Sign in with Google and complete your profile; the link fills in the team code for you. Registration closes on ${closesOn()}.`,
  ].join("\n");
}
