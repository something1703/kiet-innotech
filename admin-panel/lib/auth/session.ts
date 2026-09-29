/**
 * Where the signed-in session lives.
 * Mock mode: the chosen demo admin's email in localStorage.
 * Live mode: Cognito tokens in sessionStorage (cleared when the tab closes).
 */

export const API_MODE: "mock" | "live" = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";

/** Local development against the real backend: the demo picker signs in with tokens from its /dev/token endpoint. */
export const DEV_SIGN_IN = API_MODE === "live" && process.env.NEXT_PUBLIC_DEV_SIGN_IN === "true";

const MOCK_SESSION_KEY = "innotech-admin-session";
const TOKENS_KEY = "innotech-admin-tokens";

export type Tokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
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

export function getTokens(): Tokens | null {
  const raw = read(session, TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens | null) {
  write(session, TOKENS_KEY, tokens ? JSON.stringify(tokens) : null);
}

export function hasSession() {
  return API_MODE === "mock" ? getMockEmail() !== null : getTokens() !== null;
}

export function clearSession() {
  setMockEmail(null);
  setTokens(null);
}

/** Reads the email claim from an ID token without verifying it (the backend verifies). */
export function emailFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=")));
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

/** The email of whoever is signed in, for the "not authorised" screen. */
export function signedInEmail() {
  if (API_MODE === "mock") return getMockEmail();
  const tokens = getTokens();
  return tokens ? emailFromIdToken(tokens.idToken) : null;
}

/** Live mode with DEV_SIGN_IN: asks the local backend for a development token. */
export async function devSignIn(email: string, name: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/dev/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
  if (!response.ok) throw new Error("The backend refused the development sign-in. Is it running with ENVIRONMENT=development?");
  const data = await response.json();
  setTokens({ idToken: data.id_token, accessToken: "", refreshToken: null, expiresAt: Date.now() + data.expires_in * 1000 });
}
