/**
 * Where the signed-in session lives.
 * Mock mode: the chosen demo admin's email in localStorage.
 * Live mode: our backend's session (token, expiry, email, name) in sessionStorage (cleared when the tab closes).
 */

/** Mock data only when explicitly asked for; anything else (including unset) talks to the real backend. */
export const API_MODE: "mock" | "live" = process.env.NEXT_PUBLIC_API_MODE === "mock" ? "mock" : "live";

/** Local development against the real backend: the demo picker signs in with tokens from its /dev/token endpoint. */
export const DEV_SIGN_IN = API_MODE === "live" && process.env.NEXT_PUBLIC_DEV_SIGN_IN === "true";

const MOCK_SESSION_KEY = "innotech-admin-session";
const SESSION_KEY = "innotech-admin-auth";

/** What POST /auth/google (and /dev/token, and later email sign-in) returns. */
export type SessionResponse = {
  token: string;
  /** ISO 8601. */
  expires_at: string;
  email: string;
  name: string;
};

export type Session = {
  token: string;
  /** ISO 8601, as the server sent it. */
  expiresAt: string;
  email: string;
  name: string;
};

function read(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data). The session then lasts until reload.
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

export function getMockEmail() {
  return read(local, MOCK_SESSION_KEY);
}

export function setMockEmail(email: string | null) {
  write(local, MOCK_SESSION_KEY, email);
}

function isUsable(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const { token, expiresAt, email, name } = value as Record<string, unknown>;
  return (
    typeof token === "string" &&
    token.length > 0 &&
    typeof expiresAt === "string" &&
    Date.parse(expiresAt) > Date.now() &&
    typeof email === "string" &&
    typeof name === "string"
  );
}

/** The stored live session, or null when there is none or it is malformed or expired (it is then removed). */
export function getSession(): Session | null {
  const raw = read(session, SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isUsable(parsed)) return parsed;
  } catch {
    // Malformed: treat as signed out.
  }
  write(session, SESSION_KEY, null);
  return null;
}

/** Stores the response of any sign-in endpoint. Every sign-in method ends here. */
export function startSession(response: SessionResponse) {
  const next = {
    token: response?.token,
    expiresAt: response?.expires_at,
    email: response?.email,
    name: response?.name,
  };
  if (!isUsable(next)) throw new Error("The server sent an invalid sign-in response. Please try again.");
  write(session, SESSION_KEY, JSON.stringify(next));
}

export function hasSession() {
  return API_MODE === "mock" ? getMockEmail() !== null : getSession() !== null;
}

export function clearSession() {
  setMockEmail(null);
  write(session, SESSION_KEY, null);
}

/** The email of whoever is signed in, for the "not authorised" screen. */
export function signedInEmail() {
  if (API_MODE === "mock") return getMockEmail();
  return getSession()?.email ?? null;
}
