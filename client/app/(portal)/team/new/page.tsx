"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { draftKeys } from "@/lib/drafts";
import { useRegistrationState } from "@/lib/registration";
import type { TeamInput } from "@/lib/types";
import { Notice, buttonStyles } from "@/components/ui/form";
import { PageHeading, Panel } from "@/components/portal/PageHeading";
import { usePortal } from "@/components/portal/PortalProvider";
import { TeamForm } from "@/components/portal/TeamForm";
import { useAction } from "@/components/portal/useAction";

export default function NewTeamPage() {
  const router = useRouter();
  const { me, team, invitations, refresh } = usePortal();
  const profile = me.profile!;
  const registration = useRegistrationState();
  const { run, pending, error } = useAction();
  const created = useRef(false);

  // A student can be in only one team. Skipped right after creating one, which navigates by itself.
  useEffect(() => {
    if (team && !created.current) router.replace("/team");
  }, [team, router]);
  if (team) return null;

  const create = async (input: TeamInput) => {
    if (!(await run(() => api.createTeam(input)))) return false;
    created.current = true;
    await refresh();
    router.push("/team?created=1");
    return true;
  };

  const route = profile.participantType === "kiet" ? `the ${profile.department} department round` : "the Grand Finale directly";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading eyebrow="Step 2 of 4" title="Create your team">
        You will be the team leader. After creating the team you can add 1 to 4 registered students from{" "}
        {profile.participantType === "kiet" ? "KIET, from any department" : profile.institution}, by sharing an invite link with your team code. Your team goes to {route}.
      </PageHeading>

      {invitations.length > 0 && (
        <Notice tone="info" title={`You have ${invitations.length === 1 ? "an invitation" : `${invitations.length} invitations`} to join a team`} className="mb-6">
          If you want to join an existing team instead, accept the invitation on your{" "}
          <Link href="/dashboard" className="font-semibold underline">
            dashboard
          </Link>
          . Creating a team of your own means you cannot accept it.
        </Notice>
      )}

      {registration !== "open" ? (
        <Panel>
          <Notice tone={registration === "closed" ? "warning" : "info"} title={registration === "closed" ? "Registration has closed" : "Registration opens on 3 October 2026"}>
            {registration === "closed" ? "New teams can no longer be created." : "You can create your team once registration opens."}
          </Notice>
          <Link href="/dashboard" className={`${buttonStyles("outline", "sm")} mt-6`}>
            Back to dashboard
          </Link>
        </Panel>
      ) : (
        <Panel>
          <TeamForm
            participantType={profile.participantType}
            memberYears={[profile.year]}
            submitLabel="Create team"
            onSubmit={create}
            draftKey={draftKeys.newTeam(me.email)}
            pending={pending}
            error={error}
            onCancel={() => router.push("/dashboard")}
          />
        </Panel>
      )}
    </div>
  );
}
