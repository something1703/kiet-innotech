"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, Copy, Mail, Pencil, RefreshCw, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { categories } from "@/lib/content";
import { draftKeys, hasDraft } from "@/lib/drafts";
import { formatDate, formatDateTime } from "@/lib/format";
import { useRegistrationState } from "@/lib/registration";
import { TEAM_MAX_SIZE, openSlots, submissionChecks, yearLabel } from "@/lib/rules";
import type { RegistrationState, Team } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button, Field, Input, Notice, Pill } from "@/components/ui/form";
import { Panel } from "./PageHeading";
import { usePortal } from "./PortalProvider";
import { TeamForm } from "./TeamForm";
import { useAction } from "./useAction";

export function categoryName(number: number) {
  const category = categories.find((c) => c.number === number);
  return category ? `Category ${number}: ${category.title}` : `Category ${number}`;
}

export function TeamStatusNotice({ team }: { team: Team }) {
  if (team.status === "withdrawn" || team.status === "disqualified") {
    return (
      <Notice tone="error" title={team.status === "withdrawn" ? "Team withdrawn" : "Team disqualified"}>
        This team is no longer considered for InnoTech26. Contact the organising team if you have questions.
      </Notice>
    );
  }
  if (team.result === "finalist") {
    return (
      <Notice tone="success" title="Selected for the Grand Finale">
        Congratulations. Your team presents at the institute level Grand Finale on 30 October 2026 at KIET.
      </Notice>
    );
  }
  if (team.result === "not_selected") {
    return (
      <Notice tone="info" title="Not selected for the finale">
        Thank you for taking part in the department round. You are welcome to visit the Grand Finale exhibition on 30 October.
      </Notice>
    );
  }
  if (team.status === "submitted") {
    return (
      <Notice tone="success" title="Team submitted">
        Submitted on {formatDateTime(team.submittedAt!)}. Members and category are now locked.{" "}
        {team.route === "department"
          ? `Your team will be evaluated at the ${team.department} department round on 22 to 24 October.`
          : "Your team goes straight to the Grand Finale on 30 October 2026."}
      </Notice>
    );
  }
  return null;
}

/** Everything a student can see and do with their team. Only the leader can change it, and only before submission. */
export function TeamManager({ team }: { team: Team }) {
  const router = useRouter();
  const { me, refresh } = usePortal();
  const registration = useRegistrationState();
  const isLeader = team.leaderId === me.profile!.userId;
  const editable = team.status === "draft" && registration === "open";
  const canEdit = isLeader && editable;
  const draftKey = draftKeys.team(me.email, team.id);
  // Reopen the form if unsaved changes were kept, e.g. after signing in again.
  const [editing, setEditing] = useState(() => canEdit && hasDraft(draftKey));
  const details = useAction();

  const saveDetails = async (input: Parameters<typeof api.updateTeam>[1]) => {
    if (!(await details.run(() => api.updateTeam(team.id, input)))) return false;
    await refresh();
    setEditing(false);
    return true;
  };

  const onLeft = async () => {
    await refresh();
    router.push("/dashboard");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <div className="min-w-0 space-y-6">
        <Panel
          title="Members"
          description={`${team.members.length} of ${TEAM_MAX_SIZE}. All members are from ${team.participantType === "kiet" ? "KIET" : team.institution}.`}
        >
          <MembersTable team={team} canEdit={canEdit} leaderId={team.leaderId} />
          {team.invitations.length > 0 && <PendingInvitations team={team} canEdit={canEdit} />}
          {canEdit && openSlots(team) > 0 && <InviteForm team={team} />}
          {team.status === "draft" && !isLeader && (
            <p className="mt-6 text-sm text-muted">Only the team leader can invite or remove members.</p>
          )}
        </Panel>

        <Panel
          title="Project"
          description={canEdit && !editing ? "You can change these details until the team is submitted." : undefined}
        >
          {editing ? (
            <TeamForm
              initial={{ name: team.name, category: team.category, domain: team.domain, projectTitle: team.projectTitle, abstract: team.abstract }}
              participantType={team.participantType}
              memberYears={team.members.map((m) => m.year)}
              submitLabel="Save changes"
              onSubmit={saveDetails}
              draftKey={draftKey}
              pending={details.pending}
              error={details.error}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <dl className="divide-y divide-line">
                {[
                  ["Category", categoryName(team.category)],
                  ["Domain", team.domain],
                  ["Project title", team.projectTitle],
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-1 py-3.5 first:pt-0 sm:grid-cols-[9rem_1fr] sm:gap-4">
                    <dt className="text-sm text-muted">{label}</dt>
                    <dd className="break-words font-semibold text-ink">{value}</dd>
                  </div>
                ))}
                <div className="grid gap-1 py-3.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="text-sm text-muted">Abstract</dt>
                  <dd className="whitespace-pre-line break-words leading-relaxed text-navy-800">{team.abstract}</dd>
                </div>
              </dl>
              {canEdit && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditing(true)}>
                  <Pencil size={15} aria-hidden="true" />
                  Edit details
                </Button>
              )}
            </>
          )}
        </Panel>
      </div>

      <div className="min-w-0 space-y-6 lg:sticky lg:top-40">
        {team.status === "draft" && openSlots(team) > 0 && <TeamCodePanel team={team} canReset={canEdit} />}
        {team.status === "draft" && <SubmitPanel team={team} isLeader={isLeader} editable={editable} registration={registration} />}
        <TeamFacts team={team} />
        {((team.status === "draft" && editable) || (team.status === "withdrawn" && registration === "open")) && (
          <DangerZone team={team} deletes={isLeader && team.status === "draft"} onDone={onLeft} />
        )}
      </div>
    </div>
  );
}

function MembersTable({ team, canEdit, leaderId }: { team: Team; canEdit: boolean; leaderId: string }) {
  const { refresh } = usePortal();
  const { run, pending, error } = useAction();
  const [removing, setRemoving] = useState<Team["members"][number] | null>(null);

  const remove = async () => {
    if (!removing) return;
    if (await run(() => api.removeMember(team.id, removing.userId))) {
      setRemoving(null);
      await refresh();
    }
  };

  return (
    <>
      <table className="w-full border-collapse text-left text-[15px]">
        <thead>
          <tr className="border-b border-line text-xs font-bold uppercase tracking-wider text-muted">
            <th scope="col" className="pb-3 pr-4 font-bold">Name</th>
            <th scope="col" className="hidden pb-3 pr-4 font-bold sm:table-cell">Year</th>
            <th scope="col" className="hidden pb-3 pr-4 font-bold sm:table-cell">Role</th>
            {canEdit && (
              <th scope="col" className="pb-3">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {team.members.map((member) => {
            const leader = member.userId === leaderId;
            const role = leader ? "Leader" : "Member";
            return (
              <tr key={member.userId} className="border-b border-line last:border-0">
                <td className="py-3.5 pr-4">
                  <span className="block font-semibold text-ink">{member.fullName}</span>
                  <span className="block break-all text-sm text-muted">{member.email}</span>
                  {/* On phones, year and role sit under the name instead of in their own columns. */}
                  <span className="mt-1 block text-xs text-muted sm:hidden">
                    {yearLabel(member.year, team.participantType)}
                    {member.department ? `, ${member.department}` : ""} / {role}
                  </span>
                </td>
                <td className="hidden py-3.5 pr-4 text-sm text-muted sm:table-cell">
                  {yearLabel(member.year, team.participantType)}
                  {member.department && <span className="block">{member.department}</span>}
                </td>
                <td className="hidden py-3.5 pr-4 sm:table-cell">{leader ? <Pill tone="orange">Leader</Pill> : <span className="text-sm text-muted">Member</span>}</td>
                {canEdit && (
                  <td className="py-3.5 text-right">
                    {!leader && (
                      <Button variant="link" onClick={() => setRemoving(member)}>
                        Remove
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.fullName ?? "member"}?`}
        confirmLabel="Remove member"
        confirmVariant="danger"
        pending={pending}
        error={error}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      >
        They will no longer be part of {team.name}. You can invite them again later if you change your mind.
      </ConfirmDialog>
    </>
  );
}

function PendingInvitations({ team, canEdit }: { team: Team; canEdit: boolean }) {
  const { refresh } = usePortal();
  const { run, pending, error } = useAction();

  const cancel = async (invitationId: string) => {
    if (await run(() => api.cancelInvitation(invitationId))) await refresh();
  };

  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Waiting to accept</h3>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {team.invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <Mail size={18} className="shrink-0 text-brand-500" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block break-all text-sm font-semibold text-ink">{invitation.email}</span>
                <span className="block text-xs text-muted">Invited on {formatDate(invitation.createdAt)}</span>
              </span>
            </span>
            {canEdit && (
              <Button variant="link" onClick={() => cancel(invitation.id)} disabled={pending}>
                Cancel invite
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
    </div>
  );
}

function InviteForm({ team }: { team: Team }) {
  const { refresh } = usePortal();
  const { run, pending, error, setError } = useAction();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const slots = openSlots(team);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSent(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (await run(() => api.inviteMember(team.id, email))) {
      setSent(email.trim().toLowerCase());
      setEmail("");
      await refresh();
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 border-t border-line pt-6">
      <h3 className="font-display text-lg font-bold text-ink">Invite a teammate</h3>
      <p className="mt-1 text-sm text-muted">
        They must have signed in and completed their profile. They will see the invitation on their dashboard.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field
          id="invite-email"
          label="Student's email"
          className="flex-1"
          error={error}
          hint={`${slots} more ${slots === 1 ? "member" : "members"} can be invited.${
            team.participantType === "kiet"
              ? ` Any KIET student can join, from any department or course; the team stays in the ${team.department} department round. Use their @kiet.edu email.`
              : ""
          }`}
        >
          <Input
            id="invite-email"
            type="email"
            value={email}
            invalid={!!error}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder={team.participantType === "kiet" ? "name@kiet.edu" : "name@example.com"}
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="dark" pending={pending} className="sm:mt-7">
          <Send size={16} aria-hidden="true" />
          Send invite
        </Button>
      </div>
      {sent && (
        <Notice tone="success" className="mt-4">
          Invitation sent to {sent}.
        </Notice>
      )}
    </form>
  );
}

/** The private code teammates enter to join without an email invitation. */
function TeamCodePanel({ team, canReset }: { team: Team; canReset: boolean }) {
  const { refresh } = usePortal();
  const { run, pending, error, setError } = useAction();
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(team.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying is blocked in this browser. Select the code and copy it instead.");
    }
  };

  const reset = async () => {
    if (await run(() => api.resetJoinCode(team.id))) {
      setConfirming(false);
      await refresh();
    }
  };

  const where = team.participantType === "kiet" ? "KIET, from any department," : team.institution;
  return (
    <Panel title="Team code" description={`Registered students from ${where} can join with this code until the team is full or submitted.`}>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
        <span className="select-all font-mono text-2xl font-bold tracking-[0.2em] text-ink" aria-label={`Team code ${team.joinCode.split("").join(" ")}`}>
          {team.joinCode}
        </span>
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy size={15} aria-hidden="true" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted">Share it only with your teammates. The leader can remove anyone who joins by mistake.</p>
      {error && !confirming && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      {canReset && (
        <Button
          variant="link"
          className="mt-3"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Get a new code
        </Button>
      )}

      <ConfirmDialog
        open={confirming}
        title="Get a new team code?"
        confirmLabel="Get new code"
        pending={pending}
        error={error}
        onConfirm={reset}
        onClose={() => setConfirming(false)}
      >
        The current code {team.joinCode} stops working immediately. Members who already joined stay in the team.
      </ConfirmDialog>
    </Panel>
  );
}

function SubmitPanel({ team, isLeader, editable, registration }: { team: Team; isLeader: boolean; editable: boolean; registration: RegistrationState | null }) {
  const { refresh } = usePortal();
  const { run, pending, error, setError } = useAction();
  const [confirming, setConfirming] = useState(false);
  const checks = submissionChecks(team, registration);
  const ready = checks.every((check) => check.ok);

  const submit = async () => {
    if (await run(() => api.submitTeam(team.id))) {
      setConfirming(false);
      await refresh();
    }
  };

  return (
    <Panel title="Submit your team" description="Once submitted, members and category are locked for good.">
      <ul className="space-y-3">
        {checks.map((check) => (
          <li key={check.label} className="flex gap-3 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${check.ok ? "bg-emerald-500 text-white" : "bg-line text-muted"}`}
              aria-hidden="true"
            >
              {check.ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
            </span>
            <span className={check.ok ? "text-ink" : "text-muted"}>
              {check.label}
              <span className="sr-only">{check.ok ? " (done)" : " (not yet)"}</span>
            </span>
          </li>
        ))}
      </ul>

      {isLeader ? (
        <Button
          className="mt-6 w-full"
          disabled={!ready || !editable}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          Submit and lock team
        </Button>
      ) : (
        <p className="mt-6 text-sm text-muted">The team leader submits the team when everyone has joined.</p>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Submit ${team.name}?`}
        confirmLabel="Submit team"
        pending={pending}
        error={error}
        onConfirm={submit}
        onClose={() => setConfirming(false)}
      >
        After submission you cannot add or remove members or change the category. If any member withdraws later, the team is not
        considered further.
      </ConfirmDialog>
    </Panel>
  );
}

export const statusLabels: Record<Team["status"], string> = {
  draft: "Not submitted",
  submitted: "Submitted and locked",
  withdrawn: "Withdrawn",
  disqualified: "Disqualified",
};

function TeamFacts({ team }: { team: Team }) {
  const rows = [
    ["Team ID", team.code],
    ["Status", statusLabels[team.status]],
    [team.participantType === "kiet" ? "Department" : "Institution", team.department ?? team.institution],
    ["Route", team.route === "department" ? "Department round, then Grand Finale" : "Directly to the Grand Finale"],
    ["Created", formatDate(team.createdAt)],
  ];
  return (
    <Panel title="Team details">
      <dl className="space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** Delete (leader of a draft team) or leave. A withdrawn team can be left by anyone, so they can join another team. */
function DangerZone({ team, deletes, onDone }: { team: Team; deletes: boolean; onDone: () => Promise<void> }) {
  const { run, pending, error, setError } = useAction();
  const [confirming, setConfirming] = useState(false);
  const withdrawn = team.status === "withdrawn";

  const confirm = async () => {
    const ok = await run(() => (deletes ? api.deleteTeam(team.id) : api.leaveTeam(team.id)).then(() => true));
    if (ok) {
      setConfirming(false);
      await onDone();
    }
  };

  return (
    <Panel title={deletes ? "Delete team" : "Leave team"}>
      <p className="text-sm text-muted">
        {deletes
          ? "Deleting the team removes all members and cancels pending invitations. Everyone can then join or create another team."
          : withdrawn
            ? "This team has been withdrawn. Leave it if you want to join or create another team before registration closes."
            : "You can leave before the team is submitted, then join or create another team."}
      </p>
      <Button
        variant="danger"
        size="sm"
        className="mt-4"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        {deletes ? "Delete team" : "Leave team"}
      </Button>

      <ConfirmDialog
        open={confirming}
        title={deletes ? `Delete ${team.name}?` : `Leave ${team.name}?`}
        confirmLabel={deletes ? "Delete team" : "Leave team"}
        confirmVariant="danger"
        pending={pending}
        error={error}
        onConfirm={confirm}
        onClose={() => setConfirming(false)}
      >
        {deletes
          ? "This cannot be undone."
          : withdrawn
            ? "You cannot rejoin this team afterwards."
            : "The leader will need to invite you again if you want to rejoin."}
      </ConfirmDialog>
    </Panel>
  );
}
