"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Crown, Lock, LockOpen, MapPin, RefreshCw } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { JudgePanel, JudgeTeam } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { categories, rubrics } from "@/lib/content";
import { categoryTitle, formatDateTime, plural, roundLabels } from "@/lib/format";
import { yearLabel } from "@/lib/rules";
import { useQuery } from "@/lib/use-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Textarea } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";

/** Nine marks: two parts of 5 for each of the first four criteria, then Query Addressing out of 10 (server: rules.RUBRIC_PARTS). */
const PARTS = [5, 5, 5, 5, 5, 5, 5, 5, 10];

/** A judge's page: their rooms or panels, each team, and the rubric to score it. */
export function JudgeView() {
  const me = useAdmin();
  const view = useQuery("judge", () => api.judgeView());
  const [scoring, setScoring] = useState<{ panel: JudgePanel; team: JudgeTeam } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Judge"
        title="My judging"
        description={`Signed in as ${me.name}. You see only the teams of your own ${me.role === "judge" ? "rooms and panels" : "panels"}; nobody else sees your marks except the organisers.`}
        actions={
          <Button variant="secondary" onClick={view.reload} pending={view.loading && !!view.data}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        }
      />
      {view.error && <Notice tone="error">{view.error}</Notice>}
      {!view.data && !view.error && <Loading label="Loading your teams" />}
      {view.data && view.data.panels.length === 0 && (
        <EmptyState title="No room yet">The organisers have not put you on a room or panel yet. This page updates once they do.</EmptyState>
      )}
      {view.data?.panels.map((panel) => (
        <PanelSection key={panel.id} panel={panel} onScore={(team) => setScoring({ panel, team })} />
      ))}
      {scoring && (
        <ScoreDialog
          panel={scoring.panel}
          team={scoring.team}
          onClose={() => setScoring(null)}
          onSaved={() => {
            setScoring(null);
            view.reload();
          }}
        />
      )}
    </div>
  );
}

function PanelSection({ panel, onScore }: { panel: JudgePanel; onScore: (team: JudgeTeam) => void }) {
  const done = panel.teams.filter((t) => t.myScore).length;
  return (
    <section aria-labelledby={`judge-panel-${panel.id}`} className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{roundLabels[panel.round]}</p>
          <h2 id={`judge-panel-${panel.id}`} className="mt-0.5 flex flex-wrap items-center gap-2 font-display text-xl font-bold text-navy-900">
            {panel.name}
            {panel.department && <Pill tone="navy">{panel.department} teams</Pill>}
            {panel.chair && (
              <Pill tone="orange">
                <Crown aria-hidden="true" className="mr-1 size-3" />
                You chair this panel
              </Pill>
            )}
          </h2>
          {panel.location && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
              <MapPin aria-hidden="true" className="size-3.5" />
              {panel.location}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={`flex items-center justify-end gap-1.5 text-sm font-semibold ${panel.open ? "text-emerald-700" : "text-navy-800"}`}>
            {panel.open ? <LockOpen aria-hidden="true" className="size-4" /> : <Lock aria-hidden="true" className="size-4" />}
            {panel.open ? "Scoring is open" : "Scoring is locked"}
          </p>
          <p className="text-xs text-muted">
            {done} of {plural(panel.teams.length, "team")} scored
          </p>
        </div>
      </header>
      {!panel.open && (
        <p className="border-b border-line bg-surface px-4 py-2.5 text-sm text-muted sm:px-5">
          You can read the teams now. Marks can be saved once the organisers open scoring for this round.
        </p>
      )}
      {panel.teams.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No teams allotted to this room yet.</p>
      ) : (
        <ol className="divide-y divide-line">
          {panel.teams.map((team) => (
            <li key={team.id}>
              <button
                type="button"
                onClick={() => onScore(team)}
                className="grid w-full gap-x-4 gap-y-1 px-4 py-3.5 text-left transition hover:bg-surface/70 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:px-5"
              >
                {team.myScore ? (
                  <CheckCircle2 aria-label="Scored" className="hidden size-5 text-emerald-600 sm:block" />
                ) : (
                  <Circle aria-label="Not scored yet" className="hidden size-5 text-line sm:block" />
                )}
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    {team.tent && <span className="font-mono text-xs font-bold text-accent-600">Tent {team.tent}</span>}
                    <span className="font-semibold text-navy-900">{team.name}</span>
                    <span className="font-mono text-xs text-muted">{team.code}</span>
                  </span>
                  <span className="block truncate text-sm text-muted">{team.projectTitle}</span>
                  <span className="block text-xs text-muted">
                    Category {team.category} · {categoryTitle(team.category)} · {team.department ?? team.institution}
                  </span>
                </span>
                <span className="flex items-center gap-2 sm:justify-end">
                  {team.status !== "submitted" && <Pill tone="red">{team.status}</Pill>}
                  {team.myScore ? (
                    <span className="font-display text-lg font-bold tabular-nums text-navy-900">
                      {team.myScore.total}
                      <span className="text-xs font-semibold text-muted">/50</span>
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-brand-700">{panel.open ? "Score" : "View"}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MarkPicker({ id, max, value, onChange, disabled }: { id: string; max: number; value: number | null; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1">
      {Array.from({ length: max + 1 }, (_, mark) => (
        <button
          key={mark}
          type="button"
          role="radio"
          aria-checked={value === mark}
          disabled={disabled}
          onClick={() => onChange(mark)}
          className={`size-9 rounded-lg text-sm font-semibold tabular-nums ring-1 ring-inset transition disabled:cursor-not-allowed ${
            value === mark ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-800 ring-line hover:bg-brand-50 disabled:hover:bg-white"
          }`}
        >
          {mark}
        </button>
      ))}
    </div>
  );
}

function ScoreDialog({ panel, team, onClose, onSaved }: { panel: JudgePanel; team: JudgeTeam; onClose: () => void; onSaved: () => void }) {
  const category = categories.find((c) => c.number === team.category);
  const rubric = category ? rubrics[category.rubric] : null;
  const [marks, setMarks] = useState<(number | null)[]>(() => team.myScore?.marks ?? PARTS.map(() => null));
  const [remarks, setRemarks] = useState(team.myScore?.remarks ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = panel.open && team.status === "submitted";
  const total = marks.reduce<number>((sum, m) => sum + (m ?? 0), 0);
  const missing = marks.filter((m) => m === null).length;

  async function save() {
    if (missing) return setError(`Give a mark for every part (${missing} left).`);
    setPending(true);
    setError(null);
    try {
      await api.saveScore(panel.id, team.id, marks as number[], remarks.trim());
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  const set = (index: number, value: number) => setMarks((current) => current.map((m, i) => (i === index ? value : m)));

  return (
    <Dialog
      title={`${team.name} · ${team.code}`}
      description={`${roundLabels[panel.round]} · ${panel.name} · Category ${team.category}: ${categoryTitle(team.category)}${rubric ? ` · ${rubric.label} rubric` : ""}`}
      onClose={onClose}
      busy={pending}
      size="lg"
      footer={
        <>
          <span className="mr-auto self-center font-display text-lg font-bold tabular-nums text-navy-900">
            {total}
            <span className="text-sm font-semibold text-muted"> / 50</span>
          </span>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {editable ? "Cancel" : "Close"}
          </Button>
          {editable && (
            <Button onClick={save} pending={pending}>
              {team.myScore ? "Update marks" : "Save marks"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-2 rounded-xl bg-surface px-4 py-3 text-sm">
          <p className="font-semibold text-navy-900">{team.projectTitle}</p>
          <p className="whitespace-pre-line text-muted [overflow-wrap:anywhere]">{team.abstract}</p>
          <p className="text-xs text-muted">
            {team.domain} · {team.members.map((m) => `${m.fullName}${m.role === "leader" ? " (leader)" : ""}, ${yearLabel(m.year, team.participantType)}`).join(" · ")}
          </p>
        </section>

        {!panel.open && <Notice tone="info">Scoring is locked. You can read the rubric; marks can be saved once the organisers open this round.</Notice>}
        {panel.open && team.status !== "submitted" && <Notice tone="warning">This team has been {team.status}, so it is not scored.</Notice>}
        {team.myScore && <p className="text-xs text-muted">You last saved marks {formatDateTime(team.myScore.updatedAt)}.</p>}

        {rubric?.criteria.map((criterion, c) => {
          const parts = criterion.parts ?? [criterion.title];
          const subtotal = parts.reduce((sum, _, p) => sum + (marks[c * 2 + p] ?? 0), 0);
          return (
            <fieldset key={criterion.title} className="space-y-3 border-t border-line pt-4">
              <legend className="flex w-full items-baseline justify-between gap-3 text-sm font-semibold text-navy-900">
                <span>
                  {c + 1}. {criterion.title}
                </span>
                <span className="tabular-nums text-muted">{subtotal} / 10</span>
              </legend>
              {parts.map((part, p) => {
                const index = c * 2 + p;
                const labelId = `mark-${index}`;
                return (
                  <div key={part} className="space-y-1.5">
                    <p id={labelId} className="text-xs font-medium text-navy-800">
                      {part} <span className="text-muted">(out of {PARTS[index]})</span>
                    </p>
                    <MarkPicker id={labelId} max={PARTS[index]} value={marks[index]} onChange={(v) => set(index, v)} disabled={!editable || pending} />
                  </div>
                );
              })}
            </fieldset>
          );
        })}

        <Field label="Remarks (optional)" htmlFor="score-remarks" hint="Only the organisers see these.">
          <Textarea id="score-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} disabled={!editable || pending} />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}
