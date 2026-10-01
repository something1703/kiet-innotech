"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdminUser } from "../admin-types";
import { api, ApiError, errorMessage } from "../api";
import { setAuthFailureHandler } from "../api/live";
import { forgetGoogleAccount } from "./google";
import { DEV_SIGN_IN, clearSession, hasSession, setMockEmail, signedInEmail } from "./session";
import { devSignIn } from "./sign-in";

export type AuthState =
  | { status: "loading" }
  /** `expired`: the server rejected the session; `signed_out`: the admin chose to sign out. */
  | { status: "signed_out"; reason?: "expired" | "signed_out" }
  | { status: "unauthorised"; email: string | null; message: string }
  | { status: "error"; message: string }
  | { status: "signed_in"; admin: AdminUser };

type AuthContextValue = {
  state: AuthState;
  /** Re-checks the session with GET /admin/me. */
  refresh: () => void;
  /** Mock mode (or live with NEXT_PUBLIC_DEV_SIGN_IN): signs in as one of the demo accounts. */
  signInAsDemo: (email: string, name?: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function checkSession(): Promise<AuthState> {
  if (!hasSession()) return { status: "signed_out" };
  try {
    return { status: "signed_in", admin: await api.me() };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSession();
      return { status: "signed_out", reason: "expired" };
    }
    if (error instanceof ApiError && error.status === 403) {
      return { status: "unauthorised", email: signedInEmail(), message: error.message };
    }
    return { status: "error", message: errorMessage(error) };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    checkSession().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // Any API call can end the session: 401 signs out (PanelShell then sends the browser to
  // /login?next=<this page>), 403 from /admin/me means the account is no longer an admin.
  useEffect(() => {
    setAuthFailureHandler((failure) => {
      if (failure.status === 401) {
        clearSession();
        setState({ status: "signed_out", reason: "expired" });
      } else {
        setState({ status: "unauthorised", email: signedInEmail(), message: failure.message });
      }
    });
    return () => setAuthFailureHandler(null);
  }, []);

  const refresh = useCallback(() => {
    setState({ status: "loading" });
    setNonce((n) => n + 1);
  }, []);

  const signInAsDemo = useCallback(
    (email: string, name = email) => {
      if (!DEV_SIGN_IN) {
        setMockEmail(email);
        refresh();
        return;
      }
      devSignIn(email, name)
        .then(refresh)
        .catch((error: unknown) => setState({ status: "error", message: errorMessage(error) }));
    },
    [refresh],
  );

  /** Clears the session; PanelShell (or the login page itself) then shows /login. */
  const signOut = useCallback(() => {
    clearSession();
    forgetGoogleAccount();
    setState({ status: "signed_out", reason: "signed_out" });
  }, []);

  const value = useMemo(() => ({ state, refresh, signInAsDemo, signOut }), [state, refresh, signInAsDemo, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}

/** The signed-in admin. Only use inside the (panel) route group, which renders after sign-in. */
export function useAdmin(): AdminUser {
  const { state } = useAuth();
  if (state.status !== "signed_in") throw new Error("useAdmin used before sign-in completed.");
  return state.admin;
}
