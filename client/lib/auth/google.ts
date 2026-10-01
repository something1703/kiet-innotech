/**
 * "Sign in with Google" through Google Identity Services (https://developers.google.com/identity/gsi/web).
 *
 * The script is loaded on demand, only on the login and register pages. Google renders its own button and,
 * after the student picks an account in a popup, hands the page an ID token (the "credential"), which
 * lib/auth/session.ts exchanges for our session at POST /auth/google. There is no redirect and no callback page.
 */

type CredentialResponse = { credential?: string };

type GoogleAccountsId = {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    context?: "signin" | "signup" | "use";
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
    },
  ): void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const SCRIPT_URL = "https://accounts.google.com/gsi/client";
const LOAD_TIMEOUT_MS = 15_000;

let loading: Promise<GoogleAccountsId> | null = null;

/** Loads the Google script once. Rejects if it is blocked (content blockers, strict networks) or offline. */
function loadGoogle(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);

  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      loading = null; // Let "Try again" start over.
      reject(new Error("Google sign-in could not be loaded."));
    };
    const timer = setTimeout(fail, LOAD_TIMEOUT_MS);
    script.src = SCRIPT_URL;
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else fail();
    };
    document.head.appendChild(script);
  });
  return loading;
}

// Google allows one initialize() per page load in practice, so the callback forwards to whichever button is on screen.
let initializedFor: string | null = null;
let onCredential: ((credential: string) => void) | null = null;

/**
 * Renders Google's sign-in button into `parent`. `handle` receives the ID token after the student picks an account.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  { clientId, context, handle }: { clientId: string; context: "signin" | "signup"; handle: (credential: string) => void },
) {
  const google = await loadGoogle();
  onCredential = handle;
  if (initializedFor !== clientId) {
    google.initialize({
      client_id: clientId,
      ux_mode: "popup",
      auto_select: false,
      context,
      callback: (response) => {
        if (response.credential) onCredential?.(response.credential);
      },
    });
    initializedFor = clientId;
  }
  parent.replaceChildren();
  google.renderButton(parent, {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "pill",
    text: context === "signup" ? "signup_with" : "continue_with",
    logo_alignment: "center",
    // Google accepts 200 to 400 pixels.
    width: Math.max(200, Math.min(400, Math.floor(parent.clientWidth))),
  });
}
