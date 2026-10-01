"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { GraduationCap, LayoutDashboard, LogOut, Menu, ShieldCheck, Trophy, Users, X } from "lucide-react";
import type { AdminUser } from "@/lib/admin-types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { API_MODE } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { Loading, Notice } from "@/components/ui/Notice";
import { Brand, KietLogo } from "./Brand";
import { NotAuthorised } from "./NotAuthorised";

const nav = [
  { href: "/", label: "Overview", Icon: LayoutDashboard, superOnly: false },
  { href: "/teams", label: "Teams", Icon: Users, superOnly: false },
  { href: "/students", label: "Students", Icon: GraduationCap, superOnly: false },
  { href: "/finalists", label: "Finalists", Icon: Trophy, superOnly: false },
  { href: "/admins", label: "Admins", Icon: ShieldCheck, superOnly: true },
];

function isActive(pathname: string, href: string) {
  // The static export uses trailing slashes ("/teams/"), so compare without them.
  const path = pathname.replace(/\/+$/, "") || "/";
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

function scopeLabel(admin: AdminUser) {
  return admin.role === "super_admin" ? "Super admin · all participants" : `Admin · ${admin.department}`;
}

function NavLinks({ admin, onNavigate }: { admin: AdminUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {nav
        .filter((item) => !item.superOnly || admin.role === "super_admin")
        .map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-white text-navy-900" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon aria-hidden="true" className={`size-4 ${active ? "text-accent-500" : ""}`} />
                {label}
              </Link>
            </li>
          );
        })}
    </ul>
  );
}

function Account({ admin, onSignOut }: { admin: AdminUser; onSignOut: () => void }) {
  return (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate text-sm font-semibold text-white">{admin.name}</p>
      <p className="truncate text-xs text-white/55">{admin.email}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-brand-300">{scopeLabel(admin)}</p>
      {API_MODE === "mock" && (
        <p className="mt-1 text-[11px] text-white/45">Mock data · changes stay in this browser</p>
      )}
      <button
        type="button"
        onClick={onSignOut}
        className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white/75 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 hover:text-white"
      >
        <LogOut aria-hidden="true" className="size-3.5" />
        Sign out
      </button>
    </div>
  );
}

function Frame({ admin, onSignOut, children }: { admin: AdminUser; onSignOut: () => void; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-50 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      {/* Sidebar, large screens */}
      <aside className="bg-grid fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-950 px-4 py-5 lg:flex">
        <div className="rounded-2xl bg-white px-3 py-2.5">
          <KietLogo className="h-8 w-auto" />
        </div>
        <div className="mt-5 px-2">
          <Brand />
        </div>
        <nav aria-label="Admin" className="mt-7 flex-1">
          <NavLinks admin={admin} />
        </nav>
        <Account admin={admin} onSignOut={onSignOut} />
      </aside>

      {/* Top bar and slide-down menu, below lg */}
      <header className="sticky top-0 z-30 bg-navy-950 lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/" onClick={closeMenu} aria-label="InnoTech'26 admin overview">
            <Brand />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="panel-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex size-10 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
        <div
          id="panel-menu"
          hidden={!menuOpen}
          className="max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t border-white/10 px-4 pb-5 pt-3"
        >
          <nav aria-label="Admin">
            <NavLinks admin={admin} onNavigate={closeMenu} />
          </nav>
          <div className="mt-4">
            <Account admin={admin} onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      <main id="main" className="min-w-0 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}

/** Auth guard for every page in the (panel) route group, plus the navigation around them. */
export function PanelShell({ children }: { children: ReactNode }) {
  const { state, signOut, refresh } = useAuth();
  const router = useRouter();

  const signedOutReason = state.status === "signed_out" ? (state.reason ?? null) : undefined;
  useEffect(() => {
    if (signedOutReason === undefined) return;
    const next = `${window.location.pathname}${window.location.search}`;
    // After choosing "Sign out" there is nothing to come back to.
    router.replace(next === "/" || signedOutReason === "signed_out" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  }, [signedOutReason, router]);

  if (state.status === "signed_in") {
    return (
      <Frame admin={state.admin} onSignOut={signOut}>
        {children}
      </Frame>
    );
  }

  if (state.status === "unauthorised") return <NotAuthorised email={state.email} message={state.message} onSignOut={signOut} />;

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Notice tone="error" title="Could not load your admin account" action={<Button size="sm" variant="secondary" onClick={refresh}>Try again</Button>}>
          {state.message}
        </Notice>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Loading label={state.status === "signed_out" ? "Redirecting to sign-in" : "Checking your session"} />
    </div>
  );
}
