"use client";

import { useState } from "react";
import { Hash, Save } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { Judging } from "@/lib/admin-types";
import { categoryTitle, plural, typeShortLabels } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Pill } from "@/components/ui/Pill";
import { TableFrame, tdClass, Th } from "@/components/ui/Table";
import { AttendanceButtons } from "./AttendanceButtons";

const clean = (value: string) => value.replace(/\s+/g, "").toUpperCase();

/** Grand Finale stall numbers, one per team. (The code still calls them tents; only the words people read say stall.) */
export function TentsTab({ judging, onSaved }: { judging: Judging; onSaved: (data: Judging) => void }) {
  const rows = judging.tents ?? [];
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.team.id, r.tent ?? ""])));
  const [prefix, setPrefix] = useState("S-");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const changed = rows.filter((r) => clean(draft[r.team.id] ?? "") !== (r.tent ?? ""));
  const labels = Object.values(draft).map(clean).filter(Boolean);
  const duplicates = new Set(labels.filter((label, i) => labels.indexOf(label) !== i));

  /** Numbers every team without a stall, in category order, after the highest number already used. */
  function autoNumber() {
    const used = new Set(labels);
    let next = 1;
    const update = { ...draft };
    for (const row of rows) {
      if (clean(update[row.team.id] ?? "")) continue;
      while (used.has(clean(`${prefix}${next}`))) next += 1;
      update[row.team.id] = clean(`${prefix}${next}`);
      used.add(update[row.team.id]);
      next += 1;
    }
    setDraft(update);
  }

  async function save() {
    if (duplicates.size) return setError(`Stall ${[...duplicates][0]} is given to more than one team.`);
    setPending(true);
    setError(null);
    try {
      const data = await api.setTents(changed.map((r) => ({ teamId: r.team.id, tent: clean(draft[r.team.id] ?? "") || null })));
      onSaved(data);
      setMessage(`${plural(changed.length, "stall")} saved.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState title="No finale teams yet">
        Teams from other colleges and schools appear once submitted; department finalists once results are published.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          {plural(rows.length, "team")} exhibit at the Grand Finale: department finalists and submitted teams from other colleges and schools.{" "}
          {plural(rows.filter((r) => r.tent).length, "has a stall", "have stalls")}.
        </p>
        <AttendanceButtons round="final" label="every stall" />
      </div>

      {judging.canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-line">
          <label className="text-xs font-semibold text-navy-800" htmlFor="tent-prefix">
            Prefix
            <Input id="tent-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.slice(0, 6))} className="mt-1 w-24" />
          </label>
          <Button variant="secondary" onClick={autoNumber}>
            <Hash aria-hidden="true" className="size-4" />
            Number the rest
          </Button>
          <span className="flex-1" />
          <Button onClick={save} pending={pending} disabled={changed.length === 0}>
            {!pending && <Save aria-hidden="true" className="size-4" />}
            Save {changed.length ? plural(changed.length, "change") : "stalls"}
          </Button>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {message && !error && <Notice tone="success">{message}</Notice>}

      <TableFrame label="Stalls" minWidth="min-w-[720px]">
        <thead>
          <tr>
            <Th className="w-36">Stall</Th>
            <Th>Team</Th>
            <Th>Category</Th>
            <Th>From</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ team }) => {
            const value = draft[team.id] ?? "";
            const duplicate = duplicates.has(clean(value));
            return (
              <tr key={team.id}>
                <td className={tdClass}>
                  {judging.canManage ? (
                    <Input
                      aria-label={`Stall for ${team.name}`}
                      value={value}
                      maxLength={12}
                      onChange={(e) => setDraft((d) => ({ ...d, [team.id]: e.target.value }))}
                      aria-invalid={duplicate || undefined}
                      className={`h-8 font-mono ${duplicate ? "ring-red-500" : ""}`}
                    />
                  ) : (
                    <span className="font-mono font-bold">{value || "—"}</span>
                  )}
                </td>
                <td className={tdClass}>
                  <span className="font-semibold text-navy-900">{team.name}</span>
                  <span className="block text-xs text-muted">{team.code} · led by {team.leaderName}</span>
                </td>
                <td className={tdClass}>
                  {team.category} <span className="text-xs text-muted">{categoryTitle(team.category)}</span>
                </td>
                <td className={tdClass}>
                  <Pill tone={team.route === "department" ? "orange" : "cyan"}>{team.route === "department" ? `Finalist · ${team.department}` : typeShortLabels[team.participantType]}</Pill>
                  {team.route === "finale" && <span className="mt-0.5 block text-xs text-muted">{team.institution}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableFrame>
    </div>
  );
}
