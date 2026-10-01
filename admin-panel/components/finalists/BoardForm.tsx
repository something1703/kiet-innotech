"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { FinalistBoard } from "@/lib/admin-types";
import { categoryTitle, formatDateTime } from "@/lib/format";
import { DOUBLE_QUOTA_DEPARTMENTS } from "@/lib/rules";
import { teamHref } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Pill } from "@/components/ui/Pill";

type Selection = Record<number, string[]>;

function initialSelection(board: FinalistBoard): Selection {
  return Object.fromEntries(board.categories.map((c) => [c.category, c.nominated]));
}

/**
 * Nomination form for one department: one ruled block per category listing its submitted teams.
 * Remount it (via `key`) when the board is reloaded so the selection resets.
 */
export function BoardForm({
  board,
  onSaved,
  onConflict,
  justSaved = false,
  onEdit,
  onDirtyChange,
}: {
  board: FinalistBoard;
  onSaved: (board: FinalistBoard) => void;
  /**
   * The server refused the save because the board changed underneath (409, e.g. results were
   * published) or no longer validates (422, e.g. a nominated team was withdrawn). The parent
   * reloads the board, which remounts this form, and shows the message.
   */
  onConflict: (message: string) => void;
  /** Set by the parent after a save, since saving remounts this form. */
  justSaved?: boolean;
  onEdit?: () => void;
  /** Reports whether there are unsaved changes, so the parent can confirm before switching boards. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [selection, setSelection] = useState<Selection>(() => initialSelection(board));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = board.publishedAt !== null;

  const original = initialSelection(board);
  const changed = board.categories.filter((c) => [...(selection[c.category] ?? [])].sort().join() !== [...(original[c.category] ?? [])].sort().join());
  const total = board.categories.reduce((sum, c) => sum + (selection[c.category]?.length ?? 0), 0);
  const quotaTotal = board.categories.reduce((sum, c) => sum + (c.teams.length ? Math.min(c.quota, c.teams.length) : 0), 0);
  const dirty = changed.length > 0;

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  // Closing or reloading the tab would lose the selection.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function toggle(category: number, teamId: string, checked: boolean) {
    onEdit?.();
    setSelection((current) => {
      const list = current[category] ?? [];
      return { ...current, [category]: checked ? [...list, teamId] : list.filter((id) => id !== teamId) };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Only the categories edited here: the server replaces each category it receives, so sending
      // untouched ones from a stale board would undo another admin's nominations.
      const updated = await api.saveFinalists(
        board.department,
        changed.map((c) => ({ category: c.category, teamIds: selection[c.category] ?? [] })),
      );
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 422)) onConflict(err.message);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted">
        <p>
          <span className="font-semibold text-navy-900">{total}</span> of up to {quotaTotal} possible finalist teams nominated for{" "}
          <span className="font-semibold text-navy-900">{board.department}</span>.
          {DOUBLE_QUOTA_DEPARTMENTS.includes(board.department) && " This department may nominate two teams in Categories 1 to 4."}
        </p>
        {board.updatedAt && (
          <p className="text-xs">
            Last saved {formatDateTime(board.updatedAt)} by {board.updatedBy}
          </p>
        )}
      </div>

      {locked && (
        <Notice tone="info" title="Nominations are locked">
          Results were published on {formatDateTime(board.publishedAt)}. Nominated teams are finalists; other submitted teams are not selected.
        </Notice>
      )}

      <div className="divide-y divide-line border-y border-line">
        {board.categories.map((c) => {
          const picked = selection[c.category] ?? [];
          const full = picked.length >= c.quota;
          const headingId = `cat-${c.category}-title`;
          return (
            <fieldset key={c.category} id={`cat-${c.category}`} aria-labelledby={headingId} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={headingId} className="font-display text-base font-semibold text-navy-900">
                  <span className="mr-2 text-brand-600">{c.category}</span>
                  {categoryTitle(c.category)}
                </h3>
                <Pill tone={picked.length === 0 ? "slate" : full ? "orange" : "cyan"}>
                  <span data-testid={`count-${c.category}`}>
                    {picked.length} of {c.quota} nominated
                  </span>
                </Pill>
              </div>
              {c.teams.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No submitted {board.department} teams in this category.</p>
              ) : (
                <ul className="mt-2 grid gap-1">
                  {c.teams.map((team) => {
                    const checked = picked.includes(team.id);
                    const disabled = locked || saving || (!checked && full);
                    const inputId = `nominate-${team.id}`;
                    return (
                      <li key={team.id}>
                        <div
                          className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset transition ${
                            checked ? "bg-accent-50 ring-accent-100" : "ring-transparent hover:bg-surface"
                          } ${disabled && !checked ? "opacity-60" : ""}`}
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) => toggle(c.category, team.id, e.target.checked)}
                            className="mt-1 size-4 shrink-0 cursor-pointer accent-accent-500 disabled:cursor-not-allowed"
                          />
                          <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                            <span className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-semibold text-navy-900">{team.name}</span>
                              <span className="font-mono text-xs text-muted">{team.code}</span>
                              {team.result === "finalist" && <Pill tone="orange">Finalist</Pill>}
                            </span>
                            <span className="block text-sm text-navy-800">{team.projectTitle}</span>
                            <span className="block text-xs text-muted">
                              Led by {team.leaderName} · {team.memberCount} members
                            </span>
                          </label>
                          <Link href={teamHref(team.id)} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">
                            View<span className="sr-only"> {team.name}</span>
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!locked && full && c.teams.length > c.quota && (
                <p className="mt-2 text-xs text-muted">Quota reached. Untick a team to choose a different one.</p>
              )}
            </fieldset>
          );
        })}
      </div>

      {!locked && (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:ring-1 sm:ring-line">
          <p className="text-sm text-muted" aria-live="polite">
            {error ? (
              <span role="alert" className="font-medium text-red-700">{error}</span>
            ) : changed.length > 0 ? (
              `Unsaved changes in ${changed.length} ${changed.length === 1 ? "category" : "categories"}.`
            ) : justSaved ? (
              <span className="font-medium text-emerald-700">Nominations saved.</span>
            ) : (
              "No unsaved changes."
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setSelection(original); setError(null); }} disabled={saving || changed.length === 0}>
              Discard
            </Button>
            <Button onClick={save} pending={saving} disabled={changed.length === 0}>
              Save nominations
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
