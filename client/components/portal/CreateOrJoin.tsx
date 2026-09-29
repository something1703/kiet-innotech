"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { KeyRound, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useRegistrationState } from "@/lib/registration";
import { normaliseJoinCode } from "@/lib/rules";
import { Button, Field, Input, Notice, buttonStyles } from "@/components/ui/form";
import { Panel } from "./PageHeading";
import { usePortal } from "./PortalProvider";
import { useAction } from "./useAction";

/** For a student without a team: start one as leader, or join one with the code the leader shared. */
export function CreateOrJoin({ hasInvitations = false }: { hasInvitations?: boolean }) {
  const registration = useRegistrationState();

  return (
    <Panel
      title={hasInvitations ? "Or create or join another team" : "Create or join a team"}
      description={
        hasInvitations
          ? "Accepting an invitation above is the quickest way in. You can also start a team or use a team code."
          : "Every team has a leader. Start a team if you are leading one, or join your leader's team with its team code."
      }
    >
      {registration !== "open" ? (
        <Notice tone="info">{registration === "closed" ? "Registration has closed." : "Teams can be created and joined from 3 October 2026."}</Notice>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 md:gap-0 md:divide-x md:divide-line">
          <section aria-labelledby="create-title" className="md:pr-8">
            <h3 id="create-title" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <Plus size={20} className="text-accent-500" aria-hidden="true" />
              Start a new team
            </h3>
            <p className="mt-2 text-sm text-muted">
              You become the leader, choose the category, then add teammates by email or by sharing your team code.
            </p>
            <Link href="/team/new" className={`${buttonStyles("primary")} mt-5`}>
              Create a team
            </Link>
          </section>

          <section aria-labelledby="join-title" className="border-t border-line pt-8 md:border-t-0 md:pl-8 md:pt-0">
            <h3 id="join-title" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <KeyRound size={20} className="text-brand-500" aria-hidden="true" />
              Join with a team code
            </h3>
            <p className="mt-2 text-sm text-muted">Ask your team leader for the 8-character code shown on their Team page.</p>
            <JoinTeamForm />
          </section>
        </div>
      )}
      <p className="mt-6 text-sm text-muted">
        Not sure how teams work?{" "}
        <Link href="/guidelines#team-rules" className="font-semibold text-accent-600 hover:underline">
          Read the team rules
        </Link>
        .
      </p>
    </Panel>
  );
}

function JoinTeamForm() {
  const router = useRouter();
  const { refresh } = usePortal();
  const { run, pending, error, setError } = useAction();
  const [code, setCode] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!normaliseJoinCode(code)) return setError("Enter the 8-character team code, e.g. K7PQ-3XM9.");
    if (await run(() => api.joinTeam(code))) {
      await refresh();
      router.push("/team?joined=1");
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field id="join-code" label="Team code" className="flex-1" error={error}>
          <Input
            id="join-code"
            value={code}
            invalid={!!error}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="K7PQ-3XM9"
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono tracking-widest"
          />
        </Field>
        <Button type="submit" variant="dark" pending={pending} className="sm:mt-7">
          Join team
        </Button>
      </div>
    </form>
  );
}
