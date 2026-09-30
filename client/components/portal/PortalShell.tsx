"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { signOut, useSession } from "@/lib/auth/session";
import { useRegistrationState } from "@/lib/registration";
import { Button, Notice } from "@/components/ui/form";
import { PortalProvider } from "./PortalProvider";

const tabs = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Team", href: "/team" },
  { label: "Profile", href: "/profile" },
];

const registrationMessages = {
  upcoming: "Registration opens on 3 October 2026.",
  open: "Registration is open until 12 October 2026, 11:59 PM IST.",
  closed: "Registration closed on 12 October 2026. Teams are now locked.",
};

/** The frame around every signed-in page: header, section tabs, registration status and footer. */
export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const registration = useRegistrationState();
  const onboarding = pathname === "/onboarding";

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="InnoTech26 home">
            <Image src="/images/brand/kiet-logo.png" alt="KIET Deemed to be University" width={624} height={269} priority className="h-8 w-auto sm:h-9" />
            <span className="h-8 w-px bg-line" aria-hidden="true" />
            <span className="flex items-center gap-2">
              <Image src="/images/brand/innotech-emblem.png" alt="" width={476} height={476} priority className="h-8 w-8 sm:h-9 sm:w-9" />
              <span className="hidden font-display text-lg font-bold leading-none text-navy-900 min-[400px]:inline">
                InnoTech<span className="text-brand-500">26</span>
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {session && (
              <span className="hidden max-w-56 truncate text-sm text-muted md:block" title={session.email}>
                {session.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                signOut({ leavingPortal: true });
                router.replace("/");
              }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-navy-800 transition hover:bg-surface"
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>

        {!onboarding && (
          <nav aria-label="Portal" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ul className="-mb-px flex gap-1">
              {tabs.map((tab) => {
                const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-block border-b-2 px-3 pb-3 pt-1 text-sm font-semibold transition-colors ${
                        active ? "border-accent-500 text-ink" : "border-transparent text-muted hover:text-ink"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      {registration && (
        <p className="bg-navy-900 px-4 py-2.5 text-center text-xs font-semibold text-slate-200 sm:text-sm">
          <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${registration === "open" ? "bg-emerald-400" : "bg-accent-500"}`} aria-hidden="true" />
          {registrationMessages[registration]}
        </p>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <PortalProvider loading={<PortalLoading />} failed={(retry) => <PortalFailed retry={retry} />}>
          {children}
        </PortalProvider>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>InnoTech26, KIET Deemed to be University</p>
          <p className="flex gap-5">
            <Link href="/guidelines" className="font-semibold text-navy-800 hover:text-accent-500">Guidelines</Link>
            <Link href="/#faq" className="font-semibold text-navy-800 hover:text-accent-500">FAQ</Link>
            <Link href="/#contact" className="font-semibold text-navy-800 hover:text-accent-500">Contact</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function PortalLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="h-4 w-40 rounded-full bg-line" />
      <div className="h-10 w-72 max-w-full rounded-full bg-line" />
      <div className="h-40 rounded-3xl bg-white ring-1 ring-line" />
      <div className="h-64 rounded-3xl bg-white ring-1 ring-line" />
    </div>
  );
}

function PortalFailed({ retry }: { retry: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Notice tone="error" title="We could not load your details">
        Check your internet connection and try again. If this keeps happening, contact the InnoTech help desk.
      </Notice>
      <Button variant="dark" onClick={retry}>
        <RefreshCw size={16} aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
