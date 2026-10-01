"use client";

import Link from "next/link";
import { useState } from "react";
import { Medal } from "lucide-react";
import { api } from "@/lib/api";
import type { JudgingRound } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { departments } from "@/lib/content";
import { teamHref } from "@/lib/routes";
import { useQuery } from "@/lib/use-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { Pill } from "@/components/ui/Pill";
import { numClass, TableFrame, tdClass, Th } from "@/components/ui/Table";
import { YearChips } from "@/components/teams/YearChips";

const placeTone = ["text-accent-500", "text-slate-400", "text-amber-700"];

/** Average of each team's judges' totals, ranked with the event's tie-breakers. */
export function RankingsTab({ round }: { round: JudgingRound }) {
  const admin = useAdmin();
  const [department, setDepartment] = useState("");
  const rankings = useQuery(`rankings-${round}-${department}`, () => api.rankings(round, department || undefined));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Positions use the average of the panel judges&apos; totals (out of 50). Level teams are split by Innovation / Originality, then Query Addressing; if
          still level, the panel chair decides. Only organisers see this page; judges never see each other&apos;s marks.
        </p>
        {admin.role === "super_admin" && (
          <Field label={round === "department" ? "Department" : "Finalists from"} htmlFor="rank-department" className="w-52">
            <Select id="rank-department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {rankings.error && <Notice tone="error">{rankings.error}</Notice>}
      {!rankings.data && !rankings.error && <Loading label="Loading rankings" />}
      {rankings.data && rankings.data.groups.length === 0 && <EmptyState title="Nothing to rank yet">Rankings appear once teams are allotted and judges start scoring.</EmptyState>}
      {rankings.data?.groups.map((group) => (
        <section key={group.key} aria-labelledby={`rank-${group.key}`} className="space-y-2">
          <h3 id={`rank-${group.key}`} className="font-display text-base font-bold text-navy-900">
            {group.label}
          </h3>
          <TableFrame label={group.label} minWidth="min-w-[760px]">
            <thead>
              <tr>
                <Th className="w-16">Place</Th>
                <Th>Team</Th>
                <Th>Years</Th>
                <Th className={numClass}>Average</Th>
                <Th className={numClass}>Innovation</Th>
                <Th className={numClass}>Query</Th>
                <Th className={numClass}>Scores</Th>
              </tr>
            </thead>
            <tbody>
              {group.teams.map((row) => (
                <tr key={row.team.id} className={row.position === 1 ? "bg-accent-50/60" : ""}>
                  <td className={`${tdClass} font-display text-lg font-bold`}>
                    {row.position ? (
                      <span className="inline-flex items-center gap-1">
                        {row.position <= 3 && <Medal aria-hidden="true" className={`size-4 ${placeTone[row.position - 1]}`} />}
                        {row.position}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <Link href={teamHref(row.team.id)} className="font-semibold text-navy-900 hover:text-brand-700 hover:underline">
                      {row.team.name}
                    </Link>
                    <span className="block text-xs text-muted">
                      {row.team.code} · {row.team.department ?? row.team.institution} · {row.panel}
                    </span>
                    {row.tied && <Pill tone="orange">Level with the team above: chair decides</Pill>}
                  </td>
                  <td className={tdClass}>
                    <YearChips years={row.team.memberYears} type={row.team.participantType} />
                  </td>
                  <td className={`${tdClass} ${numClass} font-semibold text-navy-900`}>{row.average ?? "—"}</td>
                  <td className={`${tdClass} ${numClass}`}>{row.innovation ?? "—"}</td>
                  <td className={`${tdClass} ${numClass}`}>{row.query ?? "—"}</td>
                  <td className={`${tdClass} ${numClass} ${row.scores < row.judges ? "text-accent-600" : ""}`}>
                    {row.scores} / {row.judges}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        </section>
      ))}
    </div>
  );
}
