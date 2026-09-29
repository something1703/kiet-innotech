"use client";

import Link from "next/link";
import { useState } from "react";
import { Send } from "lucide-react";
import { api } from "@/lib/api";
import type { FinalistSummary } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { categories, departments } from "@/lib/content";
import { formatDateTime, typeShortLabels } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { numClass, TableFrame, tdClass, Th } from "@/components/ui/Table";
import { BoardForm } from "./BoardForm";

function Board({ department, onSaved }: { department: string; onSaved?: () => void }) {
  const board = useQuery(`finalists:${department}`, () => api.getFinalists(department));
  const [saved, setSaved] = useState(false);
  if (board.error) return <Notice tone="error">{board.error}</Notice>;
  if (!board.data || board.data.department !== department) return <Loading label={`Loading ${department} teams`} />;
  return (
    <BoardForm
      key={`${department}:${board.data.updatedAt}:${board.data.publishedAt}`}
      board={board.data}
      justSaved={saved}
      onEdit={() => setSaved(false)}
      onSaved={(updated) => {
        setSaved(true);
        board.setData(updated);
        onSaved?.();
      }}
    />
  );
}

function Matrix({ summary, onPick }: { summary: FinalistSummary; onPick: (department: string) => void }) {
  return (
    <TableFrame label="Nominations by department and category" minWidth="min-w-[760px]">
      <thead>
        <tr>
          <Th>Department</Th>
          {categories.map((c) => (
            <Th key={c.number} className="text-center" title={c.title}>
              Cat {c.number}
            </Th>
          ))}
          <Th className={numClass}>Total</Th>
        </tr>
      </thead>
      <tbody>
        {summary.matrix.map((row) => {
          const nominated = row.categories.reduce((sum, c) => sum + c.nominated, 0);
          return (
            <tr key={row.department}>
              <td className={tdClass}>
                <button type="button" onClick={() => onPick(row.department)} className="font-semibold text-navy-900 hover:text-brand-700 hover:underline">
                  {row.department}
                </button>
              </td>
              {row.categories.map((c) => {
                const target = Math.min(c.quota, c.eligible);
                const tone =
                  c.eligible === 0
                    ? "text-muted/60"
                    : c.nominated === 0
                      ? "text-muted"
                      : c.nominated >= target
                        ? "bg-accent-50 font-semibold text-accent-600"
                        : "font-semibold text-brand-700";
                return (
                  <td
                    key={c.category}
                    className={`${tdClass} text-center tabular-nums ${tone}`}
                    title={`${c.eligible} submitted, ${c.nominated} of ${c.quota} nominated`}
                  >
                    {c.eligible === 0 ? "–" : `${c.nominated}/${c.quota}`}
                  </td>
                );
              })}
              <td className={`${tdClass} ${numClass} font-semibold`}>{nominated}</td>
            </tr>
          );
        })}
      </tbody>
    </TableFrame>
  );
}

function SuperAdminFinalists() {
  const summary = useQuery("finalist-summary", () => api.finalistSummary());
  const [department, setDepartment] = useState(departments[0]);
  const [boardNonce, setBoardNonce] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  const data = summary.data;
  const nominatedTotal = data?.matrix.reduce((sum, row) => sum + row.categories.reduce((s, c) => s + c.nominated, 0), 0) ?? 0;
  const eligibleTotal = data?.matrix.reduce((sum, row) => sum + row.categories.reduce((s, c) => s + c.eligible, 0), 0) ?? 0;
  const departmentsWithout = data?.matrix.filter((row) => row.categories.some((c) => c.eligible > 0) && row.categories.every((c) => c.nominated === 0)).map((row) => row.department) ?? [];

  function pick(next: string) {
    setDepartment(next);
    document.getElementById("department-board")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-10">
      {summary.error && <Notice tone="error">{summary.error}</Notice>}
      {!data && !summary.error && <Loading label="Loading nominations" />}

      {data && (
        <section aria-labelledby="publish-title" className="space-y-3">
          <SectionTitle id="publish-title" title="Department round results" />
          {data.publishedAt ? (
            <Notice tone="success" title="Results published">
              Published {formatDateTime(data.publishedAt)} by {data.publishedBy}. Nominated teams are marked finalist and the other submitted department-round teams are marked not selected. Nominations are locked.
            </Notice>
          ) : (
            <div className="flex flex-col gap-3 border-y border-line py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                <span className="font-semibold text-navy-900">{nominatedTotal}</span> teams nominated from{" "}
                <span className="font-semibold text-navy-900">{eligibleTotal}</span> submitted KIET teams.
                {departmentsWithout.length > 0 && ` ${departmentsWithout.length} departments have not nominated yet.`}
              </p>
              <Button onClick={() => setPublishing(true)}>
                <Send aria-hidden="true" className="size-4" />
                Publish results
              </Button>
            </div>
          )}
          {published && <Notice tone="success">{published}</Notice>}
        </section>
      )}

      {data && (
        <section aria-labelledby="matrix-title">
          <SectionTitle id="matrix-title" title="Nominations by department" meta="Nominated / quota. – means no submitted teams. Select a department to edit." />
          <Matrix summary={data} onPick={pick} />
        </section>
      )}

      <section aria-labelledby="board-title" id="department-board" className="scroll-mt-20 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle id="board-title" title={`${department} nominations`} />
          <Field label="Department" htmlFor="board-department" className="sm:w-56">
            <Select id="board-department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Board key={`${department}:${boardNonce}`} department={department} onSaved={summary.reload} />
      </section>

      {data && (
        <section aria-labelledby="direct-title">
          <SectionTitle id="direct-title" title="Direct to the Grand Finale" meta="Submitted teams from other colleges and schools" />
          {data.directTeams.length === 0 ? (
            <EmptyState title="No submitted teams from other colleges or schools yet" />
          ) : (
            <TableFrame label="Teams going directly to the Grand Finale" minWidth="min-w-[720px]">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Team</Th>
                  <Th>Type</Th>
                  <Th>Institution</Th>
                  <Th className="text-center">Cat.</Th>
                  <Th className={numClass}>Members</Th>
                </tr>
              </thead>
              <tbody>
                {data.directTeams.map((team) => (
                  <tr key={team.id}>
                    <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>
                      <Link href={`/teams/${team.id}`} className="font-semibold text-brand-700 hover:underline">{team.code}</Link>
                    </td>
                    <td className={`${tdClass} font-semibold text-navy-900`}>{team.name}</td>
                    <td className={tdClass}>
                      <Pill tone="cyan">{typeShortLabels[team.participantType]}</Pill>
                    </td>
                    <td className={tdClass}>{team.institution}</td>
                    <td className={`${tdClass} text-center font-display font-bold`}>{team.category}</td>
                    <td className={`${tdClass} ${numClass}`}>{team.memberCount}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
          )}
        </section>
      )}

      {publishing && data && (
        <ConfirmDialog
          title="Publish department round results?"
          description="This cannot be undone from the panel."
          confirmLabel="Publish results"
          onClose={() => setPublishing(false)}
          onConfirm={async () => {
            const result = await api.publishResults();
            setPublishing(false);
            setPublished(`${result.finalists} teams marked finalist and ${result.notSelected} marked not selected.`);
            summary.reload();
            setBoardNonce((n) => n + 1);
          }}
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-navy-800">
            <li>{nominatedTotal} nominated teams become finalists for the Grand Finale.</li>
            <li>The other {eligibleTotal - nominatedTotal} submitted KIET teams are marked not selected.</li>
            <li>Nominations lock for every department.</li>
            {departmentsWithout.length > 0 && (
              <li className="font-medium text-red-700">
                No nominations yet from: {departmentsWithout.join(", ")}.
              </li>
            )}
          </ul>
        </ConfirmDialog>
      )}
    </div>
  );
}

export function FinalistsView() {
  const admin = useAdmin();
  const isSuper = admin.role === "super_admin";
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={isSuper ? "All departments" : `${admin.department} department`}
        title="Finalists"
        description={
          isSuper
            ? "Track every department's nominations, then publish the department round results. Teams from other colleges and schools go straight to the Grand Finale."
            : "After the department round (22 to 24 October), choose the finalist teams for each category. One team per category, or two in Categories 1 to 4 for CSE, CS, CSE(AI) and CSE(AIML)."
        }
      />
      {isSuper ? <SuperAdminFinalists /> : admin.department && <Board department={admin.department} />}
    </div>
  );
}
