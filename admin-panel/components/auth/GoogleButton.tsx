"use client";

import { useEffect, useRef, useState } from "react";
import { renderGoogleButton } from "@/lib/auth/google";
import { Button } from "@/components/ui/Button";
import { Loading, Notice } from "@/components/ui/Notice";

/** Google's own "Sign in with Google" button (popup mode). Reports the ID token through `onCredential`. */
export function GoogleButton({ onCredential, busy }: { onCredential: (credential: string) => void; busy: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const handler = useRef(onCredential);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    handler.current = onCredential;
  });

  useEffect(() => {
    const parent = ref.current;
    if (!parent) return;
    let cancelled = false;
    renderGoogleButton(parent, (credential) => handler.current(credential)).then(
      () => {
        if (!cancelled) setStatus("ready");
      },
      () => {
        if (!cancelled) setStatus("failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div>
      {status === "loading" && <Loading label="Loading Google sign-in" />}
      {status === "failed" && (
        <Notice
          tone="error"
          title="Google sign-in could not load"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setStatus("loading");
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          }
        >
          Check your connection, and allow accounts.google.com if a browser extension or network filter blocks it.
        </Notice>
      )}
      {/* Google renders its button inside this element; it stays mounted so the button survives re-renders. */}
      <div
        ref={ref}
        aria-busy={busy || undefined}
        className={`flex w-full justify-center transition ${status === "ready" ? "min-h-11" : ""} ${busy ? "pointer-events-none opacity-60" : ""}`}
      />
    </div>
  );
}
