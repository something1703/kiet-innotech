/**
 * Google Identity Services ("Sign in with Google") in popup mode. The button returns a Google ID
 * token (the "credential"), which lib/auth/sign-in.ts exchanges for our own session.
 */

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const LOAD_TIMEOUT_MS = 15_000;

type GoogleId = {
  initialize(config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode: "popup";
    auto_select?: boolean;
    context?: "signin";
  }): void;
  renderButton(
    parent: HTMLElement,
    options: { type: "standard"; theme: "outline"; size: "large"; text: "signin_with"; shape: "pill"; logo_alignment: "left"; width: number; locale: string },
  ): void;
  disableAutoSelect(): void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

/** Loads the GIS script once. Rejects if it fails or takes too long (blocked, offline); a later call retries. */
function loadGoogleId(): Promise<GoogleId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      loading = null;
      reject(new Error("Google sign-in could not be loaded."));
    };
    const timer = setTimeout(fail, LOAD_TIMEOUT_MS);
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}

let initialised = false;
let credentialHandler: ((credential: string) => void) | null = null;

/** Renders the "Sign in with Google" button into `parent`. `onCredential` receives the ID token. */
export async function renderGoogleButton(parent: HTMLElement, onCredential: (credential: string) => void) {
  const id = await loadGoogleId();
  credentialHandler = onCredential;
  // initialize() should run once per page; the latest handler is looked up at callback time.
  if (!initialised) {
    id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (response.credential) credentialHandler?.(response.credential);
      },
      ux_mode: "popup",
      auto_select: false,
      context: "signin",
    });
    initialised = true;
  }
  id.renderButton(parent, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
    logo_alignment: "left",
    // The panel is in English; without this Google picks the button's language from the visitor's browser.
    locale: "en",
    width: Math.min(400, Math.max(200, parent.clientWidth)),
  });
}

/** After sign-out, stop Google from silently picking the same account next time. */
export function forgetGoogleAccount() {
  window.google?.accounts?.id?.disableAutoSelect();
}
