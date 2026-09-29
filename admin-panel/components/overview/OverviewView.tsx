"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import type { Stats } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { categories, timeline } from "@/lib/content";
import { categoryTitle, formatDate, formatDateTime, formatNumber, typeShortLabels } from "@/lib/format";
import { REGISTRATION_CLOSES, REGISTRATION_OPENS, registrationState } from "@/lib/rules";
import { useQuery } from "@/lib/use-query";
import { AuditList } from "@/components/audit/AuditList";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { numClass, TableFrame, tdClass, Th } from "@/components/ui/Table";

function Headline({ stats }: { stats: Stats }) {
  const out = stats.teams.withdrawn + stats.teams.disqualified;
  const items = [
    { label: "Students registered", value: stats.students, note: `${formatNumber(stats.studentsInTeams)} in teams` },
    { label: "Teams", value: stats.teams.total, note: `${formatNumber(stats.pendingInvitations)} pending invitations` },
    { label: "Submitted", value: stats.teams.submitted, note: "Locked and eligible" },
    { label: "Drafts", value: stats.teams.draft, note: "Not yet submitted" },
    { label: "Withdrawn", value: out, note: stats.teams.disqualified ? `incl. ${stats.teams.disqualified} disqualified` : "Out of the event" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-5">
      {items.map((item, index) => (
        <div key={item.label} className={`bg-white px-4 py-4 sm:px-5 ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{item.label}</dt>
          <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-navy-900">{formatNumber(item.value)}</dd>
          <dd className="mt-0.5 text-xs text-muted">{item.note}</dd>
        </div>
      ))}
    </dl>
  );
}

function WindowStrip({ publishedAt }: { publishedAt: string | null }) {
  const state = registrationState();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = timeline.find((m) => m.end >= today);
  const label =
    state === "open"
      ? `Open until ${formatDate(REGISTRATION_CLOSES)}`
      : state === "upcoming"
        ? `Opens ${formatDate(REGISTRATION_OPENS)}`
        : `Closed on ${formatDate(REGISTRATION_CLOSES)}`;
  return (
    <div className="flex flex-col gap-2 border-y border-line py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
      <p className="flex items-center gap-2">
        <span className="font-semibold text-navy-900">Registration</span>
        <Pill tone={state === "open" ? "green" : state === "upcoming" ? "cyan" : "slate"}>
          {state === "open" ? "Open" : state === "upcoming" ? "Upcoming" : "Closed"}
        </Pill>
        <span className="text-muted">{label}</span>
      </p>
      {upcoming && (
        <p className="text-muted">
          Next: <span className="font-semibold text-navy-900">{upcoming.title}</span> · {upcoming.dateLabel}
        </p>
      )}
      <p className="text-muted">
        Results:{" "}
        {publishedAt ? (
          <span className="font-semibold text-navy-900">published {formatDateTime(publishedAt)}</span>
        ) : (
          <span className="font-semibold text-navy-900">not published</span>
        )}
      </p>
    </div>
  );
}

export function OverviewView() {
  const admin = useAdmin();
  const isSuper = admin.role === "super_admin";
  const stats = useQuery("stats", () => api.stats());
  const activity = useQuery("audit-recent", () => api.audit({ limit: 8 }));
  const data = stats.data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={isSuper ? "All departments, colleges and schools" : `${admin.department} department`}
        title="Overview"
        description={
          isSuper
            ? "Registrations across InnoTech'26. Department admins see the same page for their own department."
            : `Registrations of ${admin.department} students and teams led by ${admin.department} students.`
        }
      />

      {stats.error && <Notice tone="error">{stats.error}</Notice>}
      {!data && !stats.error && <Loading label="Loading numbers" />}

      {data && (
        <>
          <WindowStrip publishedAt={data.resultsPublishedAt} />
          <section aria-label="Headline numbers">
            <Headline stats={data} />
          </section>

          {data.byType && (
            <section aria-labelledby="by-type">
              <SectionTitle id="by-type" title="By participant type" meta="KIET teams take the department round; others go straight to the finale" />
              <TableFrame label="Registrations by participant type" minWidth="min-w-[480px]">
                <thead>
                  <tr>
                    <Th>Participant type</Th>
                    <Th className={numClass}>Students</Th>
                    <Th className={numClass}>Teams</Th>
                    <Th className={numClass}>Submitted</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((row) => (
                    <tr key={row.type}>
                      <td className={tdClass}>
                        <Link href={`/teams?type=${row.type}`} className="font-semibold text-navy-900 hover:text-brand-700 hover:underline">
                          {typeShortLabels[row.type]}
                        </Link>
                      </td>
                      <td className={`${tdClass} ${numClass}`}>{formatNumber(row.students)}</td>
                      <td className={`${tdClass} ${numClass}`}>{formatNumber(row.teams)}</td>
                      <td className={`${tdClass} ${numClass}`}>{formatNumber(row.submitted)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            </section>
          )}

          <section aria-labelledby="by-category">
            <SectionTitle id="by-category" title="Teams per category" />
            <TableFrame label="Teams per category" minWidth="min-w-[600px]">
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th className={numClass}>Draft</Th>
                  <Th className={numClass}>Submitted</Th>
                  <Th className={numClass}>Withdrawn</Th>
                  <Th className={numClass}>Total</Th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((row) => (
                  <tr key={row.category}>
                    <td className={tdClass}>
                      <Link href={`/teams?category=${row.category}`} className="group inline-flex gap-2 hover:text-brand-700">
                        <span className="w-4 font-display font-bold text-brand-600">{row.category}</span>
                        <span className="font-medium text-navy-900 group-hover:underline">{categoryTitle(row.category)}</span>
                      </Link>
                    </td>
                    <td className={`${tdClass} ${numClass}`}>{formatNumber(row.draft)}</td>
                    <td className={`${tdClass} ${numClass} font-semibold`}>{formatNumber(row.submitted)}</td>
                    <td className={`${tdClass} ${numClass}`}>{formatNumber(row.withdrawn + row.disqualified)}</td>
                    <td className={`${tdClass} ${numClass}`}>{formatNumber(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            <p className="mt-2 text-xs text-muted">
              School teams can enter only Categories {categories.filter((c) => c.openToSchools).map((c) => c.number).join(" and ")}; Category 6 is for first-year teams.
            </p>
          </section>

          {data.byDepartment && (
            <section aria-labelledby="by-department">
              <SectionTitle id="by-department" title="KIET teams per department" meta="A team belongs to its leader's department" />
              <TableFrame label="KIET teams per department" minWidth="min-w-[640px]">
                <thead>
                  <tr>
                    <Th>Department</Th>
                    <Th className={numClass}>Students</Th>
                    <Th className={numClass}>Draft</Th>
                    <Th className={numClass}>Submitted</Th>
                    <Th className={numClass}>Withdrawn</Th>
                    <Th className={numClass}>Teams</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDepartment.map((row) => (
                    <tr key={row.department}>
                      <td className={tdClass}>
                        <Link href={`/teams?department=${encodeURIComponent(row.department)}`} className="font-semibold text-navy-900 hover:text-brand-700 hover:underline">
                          {row.department}
                        </Link>
                      </td>
                      <td className={`${tdClass} ${numClass}`}>{formatNumber(row.students)}</td>
                      <td className={`${tdClass} ${numClass}`}>{formatNumber(row.draft)}</td>
                      <td className={`${tdClass} ${numClass} font-semibold`}>{formatNumber(row.submitted)}</td>
                      <td className={`${tdClass} ${numClass}`}>{formatNumber(row.withdrawn + row.disqualified)}</td>
                      <td className={`${tdClass} ${numClass}`}>{formatNumber(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            </section>
          )}

          <div className="grid gap-8 xl:grid-cols-2">
            <section aria-labelledby="recent-submissions" className="min-w-0">
              <SectionTitle id="recent-submissions" title="Recent submissions" meta={<Link href="/teams?status=submitted&sort=submitted_at&order=desc" className="font-semibold text-brand-700 hover:underline">All submitted teams</Link>} />
              {data.recentSubmissions.length === 0 ? (
                <EmptyState title="No submitted teams yet" />
              ) : (
                <ol className="divide-y divide-line border-y border-line">
                  {data.recentSubmissions.map((team) => (
                    <li key={team.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                      <div className="min-w-0">
                        <Link href={`/teams/${team.id}`} className="font-semibold text-navy-900 hover:text-brand-700 hover:underline">
                          {team.name}
                        </Link>
                        <p className="text-xs text-muted">
                          {team.code} · Category {team.category} · {team.department ?? team.institution} · {team.memberCount} members
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <StatusPill status={team.status} />
                        <time dateTime={team.submittedAt ?? undefined}>{formatDateTime(team.submittedAt)}</time>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-labelledby="recent-activity" className="min-w-0">
              <SectionTitle id="recent-activity" title="Recent activity" meta="Audit log, newest first" />
              {activity.error && <Notice tone="error">{activity.error}</Notice>}
              {!activity.data && !activity.error && <Loading label="Loading activity" />}
              {activity.data && (activity.data.length ? <AuditList entries={activity.data} /> : <EmptyState title="No activity yet" />)}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
