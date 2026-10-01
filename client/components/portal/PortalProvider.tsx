"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { isSigningOut, useSession } from "@/lib/auth/session";
import { isPath } from "@/lib/paths";
import { setServerRegistrationState } from "@/lib/registration";
import type { Invitation, Me, Team } from "@/lib/types";

type PortalData = {
  me: Me;
  team: Team | null;
  invitations: Invitation[];
};

type PortalContextValue = PortalData & {
  /** Reloads the profile, team and invitations after a change. */
  refresh: () => Promise<void>;
  /** Reloads quietly, keeping what is on screen if that fails. Used when an action finds the data out of date. */
  resync: () => void;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal() {
  const value = useContext(PortalContext);
  if (!value) throw new Error("usePortal must be used inside <PortalProvider>");
  return value;
}

/** `resync` from the portal, or undefined outside it. */
export function usePortalResync() {
  return useContext(PortalContext)?.resync;
}

/** Background reloads (window focus, tab shown) happen at most this often. */
const RESYNC_INTERVAL_MS = 15_000;

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function loadPortal(): Promise<PortalData> {
  const me = await api.getMe();
  if (!me.profile) return { me, team: null, invitations: [] };
  const [team, invitations] = await Promise.all([api.getMyTeam(), api.getMyInvitations()]);
  return { me, team, invitations };
}

/**
 * Loads the signed-in student's data and keeps them on the right page:
 * signed out -> /login, no profile yet -> /onboarding.
 */
export function PortalProvider({
  children,
  loading,
  failed,
}: {
  children: ReactNode;
  loading: ReactNode;
  failed: (message: string, retry: () => void) => ReactNode;
}) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Bumped when the account changes, so answers for the previous account are dropped.
  const generation = useRef(0);
  const lastLoad = useRef(0);

  const load = useCallback(({ background = false } = {}) => {
    const started = generation.current;
    lastLoad.current = Date.now();
    return loadPortal().then(
      (result) => {
        if (started !== generation.current) return;
        setServerRegistrationState(result.me.registration?.state);
        setData(result);
        setError(null);
      },
      (err: unknown) => {
        if (started !== generation.current) return;
        // 401: the API client has already ended the session, and the guard below sends the student to /login.
        if (err instanceof ApiError && err.status === 401) return;
        // A failed background reload keeps the page as it is.
        if (background) return;
        // The server's own message, e.g. "The service is down for maintenance"; network failures say so themselves.
        setError(err instanceof ApiError ? err.message : "Something went wrong while loading your details. Please try again.");
      },
    );
  }, []);

  const refresh = useCallback(() => load(), [load]);
  const resync = useCallback(() => void load({ background: true }), [load]);

  // Load once the session is known, again whenever the signed-in account changes, and on "Try again".
  const email = session?.email;
  useEffect(() => {
    if (!email) return;
    generation.current += 1;
    void load();
  }, [email, attempt, load]);

  // Reload when the student comes back to the tab, so teams and invitations changed by others show up.
  useEffect(() => {
    if (!email) return;
    const onReturn = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastLoad.current < RESYNC_INTERVAL_MS) return;
      void load({ background: true });
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [email, load]);

  // Data for a different account than the one signed in now (emails compare without case).
  const stale = !!data && !!email && !sameEmail(data.me.email, email);
  const hasProfile = data && !stale ? data.me.profile !== null : null;
  const onOnboarding = isPath(pathname, "/onboarding");

  useEffect(() => {
    if (isSigningOut()) return;
    if (session === null) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (hasProfile === false && !onOnboarding) {
      router.replace("/onboarding");
    } else if (hasProfile === true && onOnboarding) {
      router.replace("/dashboard");
    }
  }, [session, hasProfile, onOnboarding, pathname, router]);

  if (error && !stale) return failed(error, () => setAttempt((n) => n + 1));
  const redirecting = session === null || (hasProfile === false && !onOnboarding) || (hasProfile === true && onOnboarding);
  if (!session || !data || stale || redirecting) return loading;

  return <PortalContext.Provider value={{ ...data, refresh, resync }}>{children}</PortalContext.Provider>;
}
