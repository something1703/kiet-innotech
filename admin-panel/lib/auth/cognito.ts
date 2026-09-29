/**
 * Amazon Cognito Hosted UI sign-in with Google as the identity provider,
 * using the authorization-code grant with PKCE (public app client, no secret).
 */
import { getTokens, setTokens, type Tokens } from "./session";

const config = {
  domain: (process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "").replace(/\/$/, ""),
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
  redirectUri: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI ?? "",
  logoutUri: process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI ?? "",
};

const PKCE_KEY = "innotech-admin-pkce";

export function cognitoConfigured() {
  return Boolean(config.domain && config.clientId && config.redirectUri);
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** Only same-site paths are allowed as the post-login destination. */
export function safeNext(next: string | null | undefined) {
  // Browsers read "/\\host" and "/<tab>/host" as "//host", so backslashes, whitespace and control characters are refused too.
  return next && /^\/(?![/\\])[^\\\s\u0000-\u001f]*$/.test(next) ? next : "/";
}

/** Sends the browser to the Cognito Hosted UI, which forwards straight to Google. */
export async function startSignIn(next: string) {
  if (!cognitoConfigured()) throw new Error("Cognito is not configured. Set the NEXT_PUBLIC_COGNITO_* variables.");
  const verifier = randomString(48);
  const state = randomString(16);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, next: safeNext(next) }));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "openid email profile",
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: "S256",
    identity_provider: "Google",
  });
  // A full-page navigation to the external Hosted UI, not an internal route.
  window.location.href = new URL(`/oauth2/authorize?${params}`, config.domain).toString();
}

type TokenResponse = {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, ...body }),
  });
  if (!response.ok) throw new Error("Sign-in could not be completed. Please try again.");
  return response.json();
}

// The authorization code can be exchanged only once, so repeated calls (for example React
// Strict Mode running an effect twice) share one request.
const exchanges = new Map<string, Promise<string>>();

/** Exchanges the code from /auth/callback for tokens. Returns the path to continue to. */
export function completeSignIn(code: string, state: string | null): Promise<string> {
  const existing = exchanges.get(code);
  if (existing) return existing;
  const promise = (async () => {
    const stored = sessionStorage.getItem(PKCE_KEY);
    const pkce = stored ? (JSON.parse(stored) as { verifier: string; state: string; next: string }) : null;
    if (!pkce || !state || pkce.state !== state) {
      throw new Error("This sign-in link has expired or was opened in another tab. Please sign in again.");
    }
    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      code_verifier: pkce.verifier,
    });
    sessionStorage.removeItem(PKCE_KEY);
    setTokens({
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });
    return safeNext(pkce.next);
  })();
  exchanges.set(code, promise);
  return promise;
}

let refreshing: Promise<Tokens | null> | null = null;

/** A valid ID token, refreshed with the refresh token when it is about to expire. */
export async function getIdToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  if (tokens.expiresAt - 60_000 > Date.now()) return tokens.idToken;
  if (!tokens.refreshToken || !cognitoConfigured()) return null;
  refreshing ??= tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refreshToken })
    .then((fresh) => {
      const next: Tokens = {
        idToken: fresh.id_token,
        accessToken: fresh.access_token,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + fresh.expires_in * 1000,
      };
      setTokens(next);
      return next;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  const fresh = await refreshing;
  return fresh?.idToken ?? null;
}

/** Ends the Cognito session too, so the next sign-in shows the Google account chooser. */
export function signOutUrl() {
  if (!cognitoConfigured()) return "/login";
  const logoutUri = config.logoutUri || `${window.location.origin}/login`;
  return `${config.domain}/logout?${new URLSearchParams({ client_id: config.clientId, logout_uri: logoutUri })}`;
}
