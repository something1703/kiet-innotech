/**
 * Who is signed in.
 *
 * Mock mode (development): a demo student picked on the login page, stored in localStorage.
 * Live mode: Amazon Cognito Hosted UI with Google as the identity provider, using the
 * authorization code flow with PKCE. Tokens are kept in localStorage and refreshed when they expire.
 */
import { useSyncExternalStore } from "react";

export const apiMode = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";

/** Local development against the real backend: sign in with a token from its /dev/token endpoint instead of Google. */
export const devSignInEnabled = apiMode === "live" && process.env.NEXT_PUBLIC_DEV_SIGN_IN === "true";

export type Session = { email: string; name: string };

const MOCK_KEY = "innotech-mock-session";
const TOKENS_KEY = "innotech-tokens";
const PKCE_KEY = "innotech-pkce";
const CHANGE_EVENT = "innotech-session-change";

type Tokens = { idToken: string; refreshToken?: string; expiresAt: number };

const cognito = {
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "",
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
  redirectUri: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI ?? "",
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(payload)
      .split("")
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );
  return JSON.parse(json);
}

function readSession(): Session | null {
  if (apiMode === "mock") return read<Session>(MOCK_KEY);
  const tokens = read<Tokens>(TOKENS_KEY);
  if (!tokens) return null;
  const claims = decodeJwt(tokens.idToken);
  return { email: String(claims.email ?? ""), name: String(claims.name ?? claims.email ?? "") };
}

// useSyncExternalStore needs a stable snapshot, so cache by the raw stored value.
let cachedRaw: string | null | undefined;
let cachedSession: Session | null = null;

function snapshot(): Session | null {
  const raw = localStorage.getItem(apiMode === "mock" ? MOCK_KEY : TOKENS_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = readSession();
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
  return readSession();
}

// ---------- Mock mode ----------

export function mockSignIn(session: Session) {
  leaving = false;
  localStorage.setItem(MOCK_KEY, JSON.stringify({ email: session.email.trim().toLowerCase(), name: session.name.trim() }));
  notify();
}

/** Live mode with NEXT_PUBLIC_DEV_SIGN_IN: gets a development token from the local backend. */
export async function devSignIn(session: Session) {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/dev/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: session.email.trim(), name: session.name.trim() }),
  });
  if (!response.ok) throw new Error("The backend refused the development sign-in. Is it running with ENVIRONMENT=development?");
  const data = await response.json();
  const tokens: Tokens = { idToken: data.id_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  leaving = false;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  notify();
}

// ---------- Live mode (Cognito + Google) ----------

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Sends the browser to Google sign-in through the Cognito Hosted UI. */
export async function startGoogleSignIn(returnTo = "/dashboard") {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const state = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, returnTo }));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: cognito.clientId,
    redirect_uri: cognito.redirectUri,
    identity_provider: "Google",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const url = new URL("/oauth2/authorize", cognito.domain);
  url.search = params.toString();
  window.location.assign(url);
}

async function requestTokens(body: Record<string, string>): Promise<Tokens> {
  const response = await fetch(`${cognito.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cognito.clientId, ...body }),
  });
  if (!response.ok) throw new Error("Sign-in could not be completed. Please try again.");
  const data = await response.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token ?? body.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
}

/** Finishes sign-in on /auth/callback. Returns the page to continue to. */
export async function completeSignIn(code: string, state: string): Promise<string> {
  const saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? "null") as { verifier: string; state: string; returnTo: string } | null;
  sessionStorage.removeItem(PKCE_KEY);
  if (!saved || saved.state !== state) throw new Error("This sign-in link has expired. Please sign in again.");

  const tokens = await requestTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri: cognito.redirectUri,
    code_verifier: saved.verifier,
  });
  leaving = false;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  notify();
  return saved.returnTo;
}

let refreshing: Promise<string | null> | null = null;

/** A valid ID token for API calls, refreshed if it has expired. Null when signed out. */
export async function getIdToken(): Promise<string | null> {
  const tokens = read<Tokens>(TOKENS_KEY);
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt) return tokens.idToken;
  if (!tokens.refreshToken) {
    signOut();
    return null;
  }
  // Parallel requests share one refresh, which also keeps working if Cognito rotates refresh tokens.
  refreshing ??= requestTokens({ grant_type: "refresh_token", refresh_token: tokens.refreshToken })
    .then((fresh) => {
      localStorage.setItem(TOKENS_KEY, JSON.stringify(fresh));
      return fresh.idToken;
    })
    .catch(() => {
      signOut();
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

let leaving = false;

/** True while the student is signing out and leaving the portal, so guards don't redirect to /login meanwhile. */
export function isSigningOut() {
  return leaving;
}

/** Signs out. Pass `leavingPortal` when the caller navigates away itself, e.g. to the home page. */
export function signOut({ leavingPortal = false } = {}) {
  leaving = leavingPortal;
  localStorage.removeItem(apiMode === "mock" ? MOCK_KEY : TOKENS_KEY);
  notify();
}
