"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { isSigningOut, signOut, useSession } from "@/lib/auth/session";
import type { Invitation, Me, Team } from "@/lib/types";

type PortalData = {
  me: Me;
  team: Team | null;
  invitations: Invitation[];
};

type PortalContextValue = PortalData & {
  /** Reloads the profile, team and invitations after a change. */
  refresh: () => Promise<void>;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal() {
  const value = useContext(PortalContext);
  if (!value) throw new Error("usePortal must be used inside <PortalProvider>");
  return value;
}

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
export function PortalProvider({ children, loading, failed }: { children: ReactNode; loading: ReactNode; failed: (retry: () => void) => ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await loadPortal());
      setError(false);
    } catch (err) {
      // An expired or rejected session: sign out, which sends the student to /login.
      if (err instanceof ApiError && err.status === 401) return signOut();
      setError(true);
    }
  }, []);

  // Load once the session is known, and again whenever the signed-in account changes.
  const email = session?.email;
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    loadPortal()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) signOut();
        else setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const hasProfile = data ? data.me.profile !== null : null;
  const stale = data && email && data.me.email !== email;

  useEffect(() => {
    if (isSigningOut()) return;
    if (session === null) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (hasProfile === false && pathname !== "/onboarding") {
      router.replace("/onboarding");
    } else if (hasProfile === true && pathname === "/onboarding") {
      router.replace("/dashboard");
    }
  }, [session, hasProfile, pathname, router]);

  if (error && !stale) return failed(() => void refresh());
  const redirecting =
    session === null || (hasProfile === false && pathname !== "/onboarding") || (hasProfile === true && pathname === "/onboarding");
  if (!session || !data || stale || redirecting) return loading;

  return <PortalContext.Provider value={{ ...data, refresh }}>{children}</PortalContext.Provider>;
}
