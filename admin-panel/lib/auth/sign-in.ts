/**
 * Live-mode sign-in. Each method posts to the backend and hands the response to startSession().
 * Email + one-time code sign-in will return the same shape and plug in the same way.
 */
import { ApiError } from "../api/contract";
import { send } from "../api/live";
import { startSession, type SessionResponse } from "./session";

const APP = "admin";

/** Only same-site paths are allowed as the post-login destination, and never the sign-in pages themselves. */
export function safeNext(next: string | null | undefined) {
  // Browsers read "/\\host" and "/<tab>/host" as "//host", so backslashes, whitespace and control characters are refused too.
  if (!next || !/^\/(?![/\\])[^\\\s\u0000-\u001f]*$/.test(next)) return "/";
  return /^\/(login|auth)(?=$|[/?#])/i.test(next) ? "/" : next;
}

/** Exchanges the ID token from Google Identity Services for our session. 403 = not an organiser. */
export async function googleSignIn(credential: string) {
  startSession((await send("POST", "/auth/google", { body: { credential, app: APP } })) as SessionResponse);
}

/** Local development backend only (NEXT_PUBLIC_DEV_SIGN_IN=true): signs in as any email without Google. */
export async function devSignIn(email: string, name: string) {
  let response: unknown;
  try {
    response = await send("POST", "/dev/token", { body: { email, name, app: APP } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Error("The backend has no development sign-in. Is it running with ENVIRONMENT=development?");
    }
    throw error;
  }
  startSession(response as SessionResponse);
}
