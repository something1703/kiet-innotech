"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { completeSignIn } from "@/lib/auth/cognito";
import { API_MODE } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/Button";
import { Loading, Notice } from "@/components/ui/Notice";

/** Cognito redirects here with ?code=&state= after Google sign-in. */
export function CallbackView() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();
  const code = params.get("code");
  const state = params.get("state");
  const providerError = params.get("error_description") ?? params.get("error");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (API_MODE !== "live" || !code) return;
    let cancelled = false;
    completeSignIn(code, state).then(
      (next) => {
        if (cancelled) return;
        refresh();
        router.replace(next);
      },
      (err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code, state, refresh, router]);

  const message =
    API_MODE !== "live"
      ? "The sign-in callback is only used with Google sign-in (NEXT_PUBLIC_API_MODE=live)."
      : providerError
        ? `Google sign-in was cancelled or failed: ${providerError}`
        : !code
          ? "This page was opened without a sign-in code."
          : error;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
      {message ? (
        <>
          <Notice tone="error" title="Sign-in not completed">
            {message}
          </Notice>
          <ButtonLink href="/login" className="self-start">
            Back to sign-in
          </ButtonLink>
        </>
      ) : (
        <Loading label="Completing sign-in" />
      )}
    </main>
  );
}
