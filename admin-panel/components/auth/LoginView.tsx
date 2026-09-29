"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { demoAdmins } from "@/lib/api/seed";
import { resetMockData } from "@/lib/api/mock";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cognitoConfigured, safeNext, startSignIn } from "@/lib/auth/cognito";
import { API_MODE, DEV_SIGN_IN } from "@/lib/auth/session";
import { event, timeline } from "@/lib/content";
import { Button } from "@/components/ui/Button";
import { Loading, Notice } from "@/components/ui/Notice";
import { Brand, KietLogo } from "@/components/layout/Brand";
import { NotAuthorised } from "@/components/layout/NotAuthorised";

const demoAccounts = [
  ...demoAdmins.map((admin) => ({
    email: admin.email,
    name: admin.name,
    scope: admin.role === "super_admin" ? "Super admin · all departments, colleges and schools" : `Department admin · ${admin.department}`,
  })),
  { email: "rohan.verma42@gmail.com", name: "Rohan Verma", scope: "Not an admin · shows the access denied screen" },
];

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}

export function LoginView() {
  const { state, signInAsDemo, signOut } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (state.status === "signed_in") router.replace(next);
  }, [state.status, next, router]);

  if (state.status === "unauthorised") {
    return (
      <NotAuthorised
        email={state.email}
        onSignOut={() => {
          setPending(null);
          signOut();
        }}
      />
    );
  }

  async function google() {
    setError(null);
    setPending("google");
    try {
      await startSignIn(next);
    } catch (err) {
      setError(errorMessage(err));
      setPending(null);
    }
  }

  const finale = timeline[timeline.length - 1];
  const busy = state.status === "loading" || state.status === "signed_in" || pending === "google";

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="bg-grid relative flex flex-col justify-between gap-10 bg-navy-950 px-6 py-8 text-white sm:px-10 lg:py-12">
        <Brand subtitle="Organiser panel" />
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Organisers only</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
            Registrations, teams and finalists for {event.name}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Department admins see their own department&apos;s teams and students and nominate its finalists. The super
            admin sees every department, other colleges and schools, and publishes results.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 text-sm">
          <div className="bg-navy-950/80 px-4 py-3">
            <dt className="text-white/50">Registration</dt>
            <dd className="mt-0.5 font-semibold">3 – 12 Oct 2026</dd>
          </div>
          <div className="bg-navy-950/80 px-4 py-3">
            <dt className="text-white/50">{finale.title}</dt>
            <dd className="mt-0.5 font-semibold">{finale.dateLabel}</dd>
          </div>
        </dl>
      </section>

      <section className="flex items-center justify-center bg-white px-4 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <KietLogo className="h-10 w-auto" />
          <h2 className="mt-8 font-display text-2xl font-bold text-navy-900">Sign in to the admin panel</h2>
          <p className="mt-2 text-sm text-muted">
            Use the Google account your coordinator registered as an admin. Student accounts cannot sign in here.
          </p>

          {state.status === "loading" && pending === null ? (
            <Loading label="Checking your session" />
          ) : (
            <div className="mt-7 space-y-6">
              {error && <Notice tone="error">{error}</Notice>}
              {state.status === "error" && <Notice tone="error">{state.message}</Notice>}

              {API_MODE === "live" && !DEV_SIGN_IN ? (
                <>
                  <Button variant="secondary" className="w-full" onClick={google} pending={pending === "google"} disabled={busy}>
                    {pending !== "google" && <GoogleMark />}
                    Sign in with Google
                  </Button>
                  {!cognitoConfigured() && (
                    <Notice tone="warning">Cognito is not configured. Set the NEXT_PUBLIC_COGNITO_* variables.</Notice>
                  )}
                </>
              ) : (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent-600">
                    <LockKeyhole aria-hidden="true" className="size-3.5" />
                    Development sign-in
                  </div>
                  <p className="mt-1.5 text-sm text-muted">
                    {DEV_SIGN_IN ? (
                      "Signs in through the local backend's development tokens instead of Google."
                    ) : (
                      <>
                        Mock mode. Google sign-in through Cognito is used when <code className="text-xs">NEXT_PUBLIC_API_MODE=live</code>.
                      </>
                    )}
                  </p>
                  <ul className="mt-4 divide-y divide-line border-y border-line">
                    {demoAccounts.map((account) => (
                      <li key={account.email}>
                        <button
                          type="button"
                          disabled={busy}
                          aria-busy={pending === account.email || undefined}
                          onClick={() => {
                            setPending(account.email);
                            signInAsDemo(account.email, account.name);
                          }}
                          className="group flex w-full items-center gap-3 px-1 py-3 text-left transition hover:bg-surface disabled:cursor-wait disabled:opacity-60"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-navy-900">{account.name}</span>
                            <span className="block truncate text-xs text-muted">{account.email}</span>
                            <span className="mt-0.5 block text-xs font-medium text-brand-700">{account.scope}</span>
                          </span>
                          {pending === account.email && busy ? (
                            <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-brand-500" />
                          ) : (
                            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent-500" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted ${DEV_SIGN_IN ? "hidden" : ""}`}>
                    <button
                      type="button"
                      onClick={() => {
                        resetMockData();
                        setResetDone(true);
                      }}
                      className="font-semibold text-navy-800 underline underline-offset-2 hover:text-accent-600"
                    >
                      Reset demo data
                    </button>
                    {resetDone && <span role="status">Demo data restored to the original seed.</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
