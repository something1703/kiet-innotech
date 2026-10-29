"use client";

import { api } from "@/lib/api";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { useQuery } from "@/lib/use-query";
import { pickParam, useUrlParams } from "@/lib/use-url-params";
import { DeskView } from "@/components/desk/DeskView";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { FinaleJudgingTab } from "./FinaleJudgingTab";
import { FinaleResultsTab } from "./FinaleResultsTab";
import { FinaleTeamsTab } from "./FinaleTeamsTab";

const tabs = [
  { key: "teams", label: "Teams & octonorms" },
  { key: "registration", label: "Registration desk" },
  { key: "judging", label: "Judging" },
  { key: "leaderboard", label: "Leaderboard & results" },
] as const;
type Tab = (typeof tabs)[number]["key"];

/**
 * The Grand Finale in one place, for super admins: every finale team (department winners, Centres of Excellence,
 * technical clubs, schools, other colleges, start-ups, wild cards) with its octonorm or room and section; the registration
 * desk; judging (panels by octonorm range, judges, open and close, the edit switch); and the leaderboard and results.
 */
export function FinaleView() {
  const admin = useAdmin();
  const { params, update } = useUrlParams();
  const tab: Tab = pickParam(params, "tab", tabs.map((t) => t.key)) ?? "teams";
  const finale = useQuery(admin.role === "super_admin" ? "finale" : null, () => api.finale());

  if (admin.role !== "super_admin") return <Notice tone="error">The Grand Finale section is for super admins.</Notice>;
  const data = finale.data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super admin · 30 October"
        title="Grand Finale"
        description="Every team at the Grand Finale with its octonorm, the registration desk, finale judging and the results."
      />
      {data && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Teams", data.teams.length],
            ["With an octonorm or room", data.teams.filter((t) => t.octonorm || t.building || t.room).length],
            ["Registered (at least one student)", data.teams.filter((t) => t.registered > 0).length],
            ["Judging", data.publishedAt ? "Results published" : data.roundOpen ? "Open" : "Closed"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
              <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-navy-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div role="tablist" aria-label="Grand Finale sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => update({ tab: t.key === "teams" ? null : t.key })}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.key ? "border-accent-500 text-navy-900" : "border-transparent text-muted hover:text-navy-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "registration" ? (
          <DeskView embedded />
        ) : finale.error ? (
          <Notice tone="error">{finale.error}</Notice>
        ) : !data ? (
          <Loading label="Loading the Grand Finale" />
        ) : tab === "teams" ? (
          <FinaleTeamsTab finale={data} onSaved={finale.setData} reload={finale.reload} />
        ) : tab === "judging" ? (
          <FinaleJudgingTab finale={data} onFinale={finale.setData} />
        ) : (
          <FinaleResultsTab onChanged={finale.reload} />
        )}
      </div>
    </div>
  );
}
