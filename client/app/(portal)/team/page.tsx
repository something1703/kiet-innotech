"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/ui/form";
import { CreateOrJoin } from "@/components/portal/CreateOrJoin";
import { PageHeading } from "@/components/portal/PageHeading";
import { usePortal } from "@/components/portal/PortalProvider";
import { TeamManager, TeamStatusNotice, categoryName, statusLabels } from "@/components/portal/TeamManager";

export default function TeamPage() {
  const { team, invitations } = usePortal();

  if (!team) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeading eyebrow="Your team" title="You are not in a team yet">
          Start a team as its leader, or join your leader&apos;s team with its team code.
          {invitations.length > 0 && (
            <>
              {" "}
              You also have {invitations.length === 1 ? "an invitation" : `${invitations.length} invitations`} waiting on your{" "}
              <Link href="/dashboard" className="font-semibold text-accent-600 hover:underline">
                dashboard
              </Link>
              .
            </>
          )}
        </PageHeading>
        <CreateOrJoin hasInvitations={invitations.length > 0} />
      </div>
    );
  }

  return (
    <>
      <PageHeading eyebrow={`${team.code} / ${statusLabels[team.status]}`} title={team.name}>
        {categoryName(team.category)}
        {team.department ? ` / ${team.department} department` : ` / ${team.institution}`}
      </PageHeading>

      <div className="mb-6 space-y-4 empty:hidden">
        <Suspense>
          <CreatedNotice />
        </Suspense>
        <TeamStatusNotice team={team} />
      </div>

      <TeamManager team={team} />
    </>
  );
}

/** Shown once, right after the student created or joined the team. */
function CreatedNotice() {
  const params = useSearchParams();
  const { team } = usePortal();
  if (!team) return null;
  if (params.get("joined") === "1") {
    return (
      <Notice tone="success" title={`You joined ${team.name}`}>
        Your team leader submits the team once everyone has joined.
      </Notice>
    );
  }
  if (params.get("created") !== "1" || team.members.length > 1 || team.invitations.length > 0) return null;
  return (
    <Notice tone="success" title="Team created">
      Now add your teammates: share the team code, or invite them by email. You need at least one more member before you can submit.
    </Notice>
  );
}
