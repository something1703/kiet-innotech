/**
 * Who is signed in.
 *
 * Every sign-in method ends in startSession() with the backend's answer `{ token, expires_at, email, name }`:
 * Google (POST /auth/google with the ID token from Google Identity Services), the local backend's /dev/token,
 * and later email with a one-time code. That answer is kept in localStorage as it is; the browser never
 * decodes the token. There is no refresh token: once the token expires or the API answers 401, the session is over.
 *
 * Mock mode (development): the demo sign-in stores a session with a placeholder token.
 */
import { useSyncExternalStore } from "react";
import { send } from "../api/http";
import { ApiError } from "../api/types";

/** The in-browser mock only when asked for explicitly. Any other value, or none, means the live backend. */
export const apiMode: "mock" | "live" = process.env.NEXT_PUBLIC_API_MODE === "mock" ? "mock" : "live";

/** Local development against the real backend: sign in with a token from its /dev/token endpoint instead of Google. */
export const devSignInEnabled = apiMode === "live" && process.env.NEXT_PUBLIC_DEV_SIGN_IN === "true";

export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export type Session = { token: string; expiresAt: string; email: string; name: string };

/** What every sign-in endpoint returns. */
export type SessionResponse = { token: string; expires_at: string; email: string; name: string };

const SESSION_KEY = "innotech-session";
const CHANGE_EVENT = "innotech-session-change";

let leaving = false;
let ended = false;

function readRaw() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function clear() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage is blocked; there is nothing to clear.
  }
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The stored session, or null if it is missing, malformed or expired. */
function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const { token, expiresAt, email, name } = (JSON.parse(raw) ?? {}) as Partial<Session>;
    if (typeof token !== "string" || !token || typeof email !== "string" || !email.includes("@")) return null;
    if (typeof expiresAt !== "string" || !(Date.parse(expiresAt) > Date.now())) return null;
    return { token, expiresAt, email: email.trim().toLowerCase(), name: typeof name === "string" ? name.trim() : "" };
  } catch {
    return null;
  }
}

// useSyncExternalStore needs a stable snapshot, so cache by the raw stored value.
let cachedRaw: string | null | undefined;
let cachedSession: Session | null = null;

function snapshot(): Session | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parseSession(raw);
    // A malformed or expired session is removed, so it cannot get in the way again.
    if (raw && !cachedSession) clear();
  }
  return cachedSession;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The current session. `undefined` while rendering on the server, before the browser can be read. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

export function getSession() {
  return parseSession(readRaw());
}

/** The token for API calls, or null when signed out or expired. */
export function getToken() {
  return getSession()?.token ?? null;
}

/** Starts a session from a sign-in response. Every sign-in method ends here. */
export function startSession(response: SessionResponse): Session {
  const candidate = { token: response?.token, expiresAt: response?.expires_at, email: response?.email, name: response?.name };
  const session = parseSession(JSON.stringify(candidate));
  if (!session) throw new ApiError("Sign-in did not complete. Please try again.", 0);
  leaving = false;
  ended = false;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notify();
  return session;
}

/** Signs in with the ID token Google Identity Services hands to the page. */
export async function signInWithGoogle(credential: string) {
  const response = await send("POST", "/auth/google", { body: { credential, app: "portal" } });
  return startSession(response as unknown as SessionResponse);
}

/** Live mode with NEXT_PUBLIC_DEV_SIGN_IN: gets a development token from the local backend. */
export async function devSignIn({ email, name }: { email: string; name: string }) {
  try {
    const response = await send("POST", "/dev/token", { body: { email: email.trim(), name: name.trim(), app: "portal" } });
    return startSession(response as unknown as SessionResponse);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new ApiError("The backend refused the development sign-in. Is it running with ENVIRONMENT=development?", 404);
    }
    throw err;
  }
}

/** Mock mode: signs in as anyone, with a placeholder token that lasts as long as a real one. */
export function mockSignIn({ email, name }: { email: string; name: string }) {
  return startSession({ token: "mock", expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), email, name });
}

/** True while the student is signing out and leaving the portal, so guards don't redirect to /login meanwhile. */
export function isSigningOut() {
  return leaving;
}

/** True when the last session ended by itself (expired or rejected by the server), so the login page can say so. */
export function sessionEnded() {
  return ended;
}

/** Signs out. Pass `leavingPortal` when the caller navigates away itself, e.g. to the home page. */
export function signOut({ leavingPortal = false } = {}) {
  leaving = leavingPortal;
  ended = false;
  clear();
  notify();
}

/**
 * The token expired or the server answered 401: the session is over. The portal guard in PortalProvider
 * then sends the student to /login?next=<current page>; forms keep their drafts in sessionStorage meanwhile.
 */
export function endSession() {
  leaving = false;
  ended = true;
  clear();
  notify();
}
