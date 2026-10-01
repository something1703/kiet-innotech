"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Ban, RotateCcw, UserMinus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AdminTeam } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { categoryTitle, formatDate, formatDateTime, otherMemberDepartments, participantTypeLabels, routeLabels, statusLabels } from "@/lib/format";
import { yearLabel } from "@/lib/rules";
import { isTeamId } from "@/lib/routes";
import { useQuery } from "@/lib/use-query";
import { AuditList } from "@/components/audit/AuditList";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading, Notice } from "@/components/ui/Notice";
import { SectionTitle } from "@/components/ui/PageHeader";
import { Pill, ResultPill, StatusPill } from "@/components/ui/Pill";
import { TableFrame, tdClass, Th } from "@/components/ui/Table";

type Action = "withdraw" | "disqualify" | "restore";

const actionCopy: Record<Action, { title: string; confirm: string; tone: "primary" | "danger"; description: (team: AdminTeam) => ReactNode }> = {
  withdraw: {
    title: "Mark team withdrawn",
    confirm: "Mark withdrawn",
    tone: "danger",
    description: (team) => (
      <>
        <strong className="text-navy-900">{team.name}</strong> ({team.code}) will no longer be considered. Pending invitations are cancelled and any finalist nomination is removed.
      </>
    ),
  },
  disqualify: {
    title: "Disqualify team",
    confirm: "Disqualify",
    tone: "danger",
    description: (team) => (
      <>
        <strong className="text-navy-900">{team.name}</strong> ({team.code}) will be disqualified from InnoTech26. Only the super admin can restore it.
      </>
    ),
  },
  restore: {
    title: "Restore team",
    confirm: "Restore",
    tone: "primary",
    description: (team) => (
      <>
        <strong className="text-navy-900">{team.name}</strong> ({team.code}) will return to{" "}
        <strong className="text-navy-900">{team.submittedAt ? statusLabels.submitted : statusLabels.draft}</strong>. Cancelled invitations are not restored.
      </>
    ),
  },
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-navy-900">{children}</dd>
    </div>
  );
}

const back = (
  <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
    <ArrowLeft aria-hidden="true" className="size-4" />
    All teams
  </Link>
);

function TeamNotFound({ known }: { known: boolean }) {
  return (
    <div className="space-y-4">
      {back}
      <EmptyState
        title="Team not found"
        action={
          <ButtonLink href="/teams" size="sm">
            Back to all teams
          </ButtonLink>
        }
      >
        {known ? "No team with this ID exists. It may have been deleted by its leader." : "This link does not point to a team."} Find the team in
        the list instead.
      </EmptyState>
    </div>
  );
}

/** Renders inside <Suspense> (useSearchParams): the team ID comes from /teams/view/?id=. */
export function TeamDetail() {
  const id = useSearchParams().get("id");
  if (!isTeamId(id)) return <TeamNotFound known={false} />;
  // Keyed so moving between teams (back/forward) starts fresh instead of showing the previous team.
  return <TeamView key={id} id={id} />;
}

function TeamView({ id }: { id: string }) {
  const admin = useAdmin();
  const isSuper = admin.role === "super_admin";
  const [notFound, setNotFound] = useState(false);
  const team = useQuery(`team:${id}`, () =>
    api.getTeam(id).catch((error: unknown) => {
      // The live API answers 422 for an ID that is not a UUID; both mean "no such team".
      if (error instanceof ApiError && (error.status === 404 || error.status === 422)) setNotFound(true);
      throw error;
    }),
  );
  const history = useQuery(team.data ? `team-audit:${id}` : null, () => api.audit({ teamId: id, limit: 100 }));
  const [action, setAction] = useState<Action | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (notFound && !team.data) return <TeamNotFound known />;

  if (team.error && !team.data) {
    return (
      <div className="space-y-4">
        {back}
        <Notice tone="error" title="This team cannot be shown">
          {team.error}
        </Notice>
      </div>
    );
  }
  if (!team.data) return <Loading label="Loading team" />;

  const t = team.data;
  const canWithdraw = t.status === "draft" || t.status === "submitted";
  const canDisqualify = isSuper && canWithdraw;
  const canRestore = isSuper && (t.status === "withdrawn" || t.status === "disqualified");

  async function run(kind: Action, reason: string) {
    const updated =
      kind === "withdraw"
        ? await api.withdrawTeam(t.id, reason)
        : kind === "disqualify"
          ? await api.disqualifyTeam(t.id, reason)
          : await api.restoreTeam(t.id, reason);
    team.setData(updated);
    history.reload();
    setAction(null);
    setDone(`${updated.code} is now ${statusLabels[updated.status].toLowerCase()}.`);
  }

  const leader = t.members.find((m) => m.role === "leader");
  const otherDepartments = otherMemberDepartments(t);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {back}
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold tracking-wider text-brand-600">{t.code}</p>
            <h1 className="mt-1 font-display text-2xl font-bold break-words text-navy-900 sm:text-3xl">{t.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={t.status} />
              <ResultPill result={t.result} />
              <Pill tone={t.route === "finale" ? "orange" : "cyan"}>{routeLabels[t.route]}</Pill>
              {otherDepartments.length > 0 && <Pill tone="navy">Mixed departments</Pill>}
            </div>
          </div>
          {(canWithdraw || canDisqualify || canRestore) && (
            <div className="flex flex-wrap gap-2">
              {canWithdraw && (
                <Button variant="secondary" onClick={() => setAction("withdraw")}>
                  <UserMinus aria-hidden="true" className="size-4" />
                  Mark withdrawn
                </Button>
              )}
              {canDisqualify && (
                <Button variant="danger" onClick={() => setAction("disqualify")}>
                  <Ban aria-hidden="true" className="size-4" />
                  Disqualify
                </Button>
              )}
              {canRestore && (
                <Button onClick={() => setAction("restore")}>
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Restore
                </Button>
              )}
            </div>
          )}
        </header>
        {done && <Notice tone="success">{done} The change is recorded in the history below.</Notice>}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="team-facts">
          <SectionTitle id="team-facts" title="Registration" />
          <dl className="border-t border-line">
            <Fact label="Category">
              {t.category}. {categoryTitle(t.category)}
            </Fact>
            <Fact label="Domain">{t.domain}</Fact>
            <Fact label="Participant type">{participantTypeLabels[t.participantType]}</Fact>
            <Fact label="Institution">{t.institution}</Fact>
            <Fact label="Department">
              {t.department ? (
                <>
                  {t.department} <span className="text-muted">(leader&apos;s department)</span>
                  {otherDepartments.length > 0 && (
                    <span className="block text-sm text-muted">Also has members from {otherDepartments.join(", ")}</span>
                  )}
                </>
              ) : (
                "—"
              )}
            </Fact>
            <Fact label="Route">{routeLabels[t.route]}</Fact>
            <Fact label="Team code">
              <span className="font-mono tracking-wider">{t.joinCode}</span>
            </Fact>
            <Fact label="Leader">{leader ? `${leader.fullName} (${leader.email})` : "—"}</Fact>
            <Fact label="Created">{formatDateTime(t.createdAt)}</Fact>
            <Fact label="Submitted">{formatDateTime(t.submittedAt)}</Fact>
          </dl>
        </section>
        <section aria-labelledby="team-project">
          <SectionTitle id="team-project" title="Project" />
          <div className="border-t border-line pt-3">
            <h3 className="font-display text-lg font-semibold text-navy-900">{t.projectTitle || "Untitled project"}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-800">{t.abstract || "No abstract yet."}</p>
          </div>
        </section>
      </div>

      <section aria-labelledby="team-members">
        <SectionTitle id="team-members" title={`Members (${t.members.length})`} meta="Team size must be 2 to 5 at submission" />
        <TableFrame label="Team members" minWidth="min-w-[860px]">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Roll no.</Th>
              <Th>Department</Th>
              <Th>Course</Th>
              <Th>Year</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {t.members.map((m) => (
              <tr key={m.userId}>
                <td className={`${tdClass} whitespace-nowrap font-semibold text-navy-900`}>
                  {m.fullName} {m.role === "leader" && <Pill tone="navy">Leader</Pill>}
                </td>
                <td className={tdClass}>
                  <a href={`mailto:${m.email}`} className="break-all text-brand-700 hover:underline">
                    {m.email}
                  </a>
                </td>
                <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                  <a href={`tel:+91${m.phone}`} className="hover:underline">
                    {m.phone}
                  </a>
                </td>
                <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>{m.rollNumber || "—"}</td>
                <td className={tdClass}>
                  {m.department ?? "—"}
                  {t.department && m.department && m.department !== t.department && <span className="block text-xs text-muted">Other branch</span>}
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>{m.course}</td>
                <td className={`${tdClass} whitespace-nowrap`}>{yearLabel(m.year, t.participantType)}</td>
                <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDate(m.joinedAt)}</td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </section>

      <section aria-labelledby="team-invitations">
        <SectionTitle id="team-invitations" title="Pending invitations" />
        {t.invitations.length === 0 ? (
          <p className="border-y border-line py-3 text-sm text-muted">No pending invitations.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {t.invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="break-all font-medium text-navy-900">{inv.email}</span>
                <span className="text-muted">Invited {formatDateTime(inv.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="team-history">
        <SectionTitle id="team-history" title="History" meta="Audit log for this team" />
        {history.error && <Notice tone="error">{history.error}</Notice>}
        {!history.data && !history.error && <Loading label="Loading history" />}
        {history.data && (history.data.length ? <AuditList entries={history.data} showTeam={false} /> : <EmptyState title="No history yet" />)}
      </section>

      <p>
        <ButtonLink href="/teams" size="sm">
          Back to all teams
        </ButtonLink>
      </p>

      {action && (
        <ConfirmDialog
          title={actionCopy[action].title}
          description={actionCopy[action].description(t)}
          confirmLabel={actionCopy[action].confirm}
          tone={actionCopy[action].tone}
          reasonLabel="Reason"
          onConfirm={(reason) => run(action, reason)}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}
