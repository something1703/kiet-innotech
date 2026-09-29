"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { completeSignIn } from "@/lib/auth/session";
import { Notice, buttonStyles } from "@/components/ui/form";

/** Google (through Cognito) sends the student back here with a one-time code. */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The code can be exchanged only once, so guard against the effect running twice in development.
    if (started.current) return;
    started.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const providerError = params.get("error_description") ?? params.get("error");

    const finish = async () => {
      if (providerError || !code || !state) throw new Error(providerError ?? "Sign-in was cancelled.");
      router.replace(await completeSignIn(code, state));
    };
    finish().catch((err: Error) => setError(err.message));
  }, [params, router]);

  if (error) {
    return (
      <div className="w-full max-w-md space-y-5">
        <Notice tone="error" title="Sign-in did not complete">
          {error}
        </Notice>
        <Link href="/login" className={buttonStyles("dark")}>
          Back to login
        </Link>
      </div>
    );
  }

  return <Signing />;
}

function Signing() {
  return (
    <p className="flex items-center gap-3 font-semibold text-navy-800" role="status">
      <LoaderCircle size={20} className="animate-spin text-accent-500" aria-hidden="true" />
      Signing you in...
    </p>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Suspense fallback={<Signing />}>
        <Callback />
      </Suspense>
    </main>
  );
}
