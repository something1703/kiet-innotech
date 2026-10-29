"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { judgeSignIn } from "@/lib/auth/sign-in";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

/**
 * Outside judges and registration desk volunteers at the Grand Finale: the email and password the organisers gave them,
 * instead of Google. The session opens the judge's own judging page, or the registration desk, only.
 */
export function JudgeSignIn({ onSignedIn, disabled }: { onSignedIn: () => void; disabled?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and the password the organisers gave you.");
    setPending(true);
    setError(null);
    try {
      await judgeSignIn(email, password);
      onSignedIn();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Email" htmlFor="judge-email">
        <Input id="judge-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor="judge-password" hint="From the organisers, e.g. Arunesh@12345. Capital letters matter.">
        <div className="relative">
          <Input
            id="judge-password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-navy-900"
          >
            {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          </button>
        </div>
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" pending={pending} disabled={disabled} className="w-full">
        {!pending && <KeyRound aria-hidden="true" className="size-4" />}
        Sign in as a judge
      </Button>
    </form>
  );
}
