"use client";

import { useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { Finale, FinaleEntryInput, FinaleSection, FinaleTeam, OctonormImport, OctonormImportRow } from "@/lib/admin-types";
import { plural } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Pill } from "@/components/ui/Pill";
import { TableFrame, tdClass, Th } from "@/components/ui/Table";

const kindOf: Record<FinaleSection, string> = { category: "kiet", coe: "kiet", club: "kiet", school: "school", college: "college", startup: "startup" };

/**
 * The organisers' octonorm list (their Excel sheet) onto the Grand Finale teams. The server reads the sheet and matches
 * every stall (by team code for department winners, by name for the others); nothing changes until Apply, which saves
 * through the same save as the Teams tab (one team per octonorm, or it is refused).
 */
export function OctonormImportDialog({ finale, onClose, onSaved }: { finale: Finale; onClose: () => void; onSaved: (data: Finale, message: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<OctonormImport | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [onlyLook, setOnlyLook] = useState(false);
  const [clearOthers, setClearOthers] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const teamOf = new Map(finale.teams.map((t) => [t.team.id, t]));

  async function read() {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const data = await api.previewOctonormImport(file);
      setPreview(data);
      setChoice(Object.fromEntries(data.rows.map((r) => [r.octonorm, r.status === "same" || r.status === "change" ? (r.team?.id ?? "") : ""])));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const rows = preview?.rows ?? [];
  const chosen = rows.filter((r) => choice[r.octonorm]);
  const ids = chosen.map((r) => choice[r.octonorm]);
  const twice = new Set(ids.filter((id, i) => ids.indexOf(id) !== i));
  const chosenIds = new Set(ids);

  /** What Apply saves: each chosen team at the sheet's octonorm and section (its building and room stay as they are). */
  function entryFor(row: OctonormImportRow, team: FinaleTeam): FinaleEntryInput {
    const section = row.section === team.defaultSection ? null : row.section;
    return { teamId: team.team.id, octonorm: row.octonorm, building: team.building, room: team.room, section };
  }
  const entries: FinaleEntryInput[] = chosen.flatMap((row) => {
    const team = teamOf.get(choice[row.octonorm]);
    if (!team) return [];
    const next = entryFor(row, team);
    const sectionNow = team.section === team.defaultSection ? null : team.section;
    return team.octonorm === next.octonorm && sectionNow === next.section ? [] : [next];
  });
  const others = finale.teams.filter((t) => !chosenIds.has(t.team.id) && t.octonorm);
  const clears: FinaleEntryInput[] = clearOthers
    ? others.map((t) => ({ teamId: t.team.id, octonorm: null, building: t.building, room: t.room, section: t.section === t.defaultSection ? null : t.section }))
    : [];
  // An octonorm of the sheet still held by a team that is not being moved: the save would refuse it.
  const blocked = rows.filter((r) => choice[r.octonorm] && !clearOthers && others.some((t) => t.octonorm === r.octonorm));
  const counts = {
    same: rows.filter((r) => choice[r.octonorm] && teamOf.get(choice[r.octonorm])?.octonorm === r.octonorm).length,
    change: entries.length,
    open: rows.filter((r) => !choice[r.octonorm]).length,
  };
  const needsLook = (r: OctonormImportRow) => r.status !== "same" || r.note !== null || !choice[r.octonorm];
  const shown = onlyLook ? rows.filter(needsLook) : rows;

  async function apply() {
    setPending(true);
    setError(null);
    try {
      const saved = await api.saveFinaleEntries([...clears, ...entries]);
      onSaved(saved, `Octonorm list applied: ${plural(entries.length, "team")} given their octonorm${clears.length ? `, ${clears.length} not in the list cleared` : ""}.`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      title="Import the octonorm list"
      description="Upload the organisers' Excel sheet (LIST OF OCTONORMS STALL). Every stall is matched to a team; check the list, choose where it is unsure, then apply. Nothing changes before you press Apply."
      onClose={onClose}
      busy={pending}
      size="xl"
      footer={
        <>
          {preview && (
            <span className="mr-auto self-center text-sm text-muted">
              {counts.same} already in place · {counts.change} to change · {counts.open} without a team
            </span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          {preview ? (
            <Button onClick={apply} pending={pending} disabled={entries.length + clears.length === 0 || twice.size > 0 || blocked.length > 0}>
              Apply {plural(entries.length + clears.length, "change")}
            </Button>
          ) : (
            <Button onClick={read} pending={pending} disabled={!file}>
              <Upload aria-hidden="true" className="size-4" />
              Read the sheet
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {!preview && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface px-4 py-8 text-center hover:border-brand-500">
            <FileSpreadsheet aria-hidden="true" className="size-8 text-brand-600" />
            <span className="font-semibold text-navy-900">{file ? file.name : "Choose the Excel file (.xlsx)"}</span>
            <span className="text-xs text-muted">The sheet with Number, University and “Team name &amp; ID”.</span>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {preview && (
          <>
            {twice.size > 0 && <Notice tone="error">The same team is chosen for two octonorms. Choose another team for one of them.</Notice>}
            {blocked.length > 0 && (
              <Notice tone="warning">
                {plural(blocked.length, "octonorm")} of the sheet ({blocked.map((r) => r.octonorm).slice(0, 8).join(", ")}
                {blocked.length > 8 ? "…" : ""}) are held now by teams the sheet does not name. Tick “Take octonorms away from teams the sheet does not name” below,
                or give those teams another octonorm on the Teams tab first.
              </Notice>
            )}
            {preview.notInSheet.length > 0 && (
              <Notice tone="info" title={`${plural(preview.notInSheet.length, "Grand Finale team")} not in the sheet`}>
                {preview.notInSheet
                  .slice(0, 12)
                  .map((c) => `${c.team.code} ${c.team.name}${c.octonorm ? ` (octonorm ${c.octonorm})` : ""}`)
                  .join(" · ")}
                {preview.notInSheet.length > 12 ? " …" : ""}
              </Notice>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2 font-semibold text-navy-800">
                <Checkbox label="Only rows that need a look" checked={onlyLook} onChange={setOnlyLook} />
                Only rows that need a look ({rows.filter(needsLook).length})
              </label>
              <label className="inline-flex items-center gap-2 font-semibold text-navy-800">
                <Checkbox label="Take octonorms away from teams the sheet does not name" checked={clearOthers} onChange={setClearOthers} />
                Take octonorms away from teams the sheet does not name ({others.length})
              </label>
            </div>
            <TableFrame label="Octonorm list" minWidth="min-w-[900px]">
              <thead>
                <tr>
                  <Th className="w-20">Octonorm</Th>
                  <Th>In the sheet</Th>
                  <Th>Team on the site</Th>
                  <Th className="w-28">Now</Th>
                  <Th>Check</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const picked = choice[r.octonorm] ?? "";
                  const team = teamOf.get(picked);
                  const pool = finale.teams.filter((t) => t.team.participantType === kindOf[r.section] && (r.section !== "coe" && r.section !== "club" ? true : t.team.department === "COE"));
                  const top = new Set(r.candidates.map((c) => c.team.id));
                  const inPlace = team?.octonorm === r.octonorm;
                  return (
                    <tr key={r.octonorm} className={!picked ? "bg-accent-50/60" : twice.has(picked) ? "bg-red-50" : ""}>
                      <td className={`${tdClass} font-display text-lg font-bold tabular-nums text-navy-900`}>{r.octonorm}</td>
                      <td className={`${tdClass} max-w-[18rem]`}>
                        <span className="block text-sm text-navy-900">{r.label}</span>
                        <span className="text-xs text-muted">{r.section === "category" ? `Category ${r.category}` : finale.sections[r.section]}</span>
                      </td>
                      <td className={tdClass}>
                        {r.status === "not_in_finale" ? (
                          <span className="text-sm font-semibold text-red-700">{r.team ? `${r.team.code} ${r.team.name}` : r.code}</span>
                        ) : (
                          <Select aria-label={`Team for octonorm ${r.octonorm}`} value={picked} onChange={(e) => setChoice((c) => ({ ...c, [r.octonorm]: e.target.value }))} className="h-9 max-w-[20rem]">
                            <option value="">No team</option>
                            {r.candidates.length > 0 && (
                              <optgroup label="Best matches">
                                {r.candidates.map((c) => (
                                  <option key={c.team.id} value={c.team.id}>
                                    {c.team.code} {c.team.name} · {c.club || c.team.institution}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Every team of this kind">
                              {pool
                                .filter((t) => !top.has(t.team.id))
                                .map((t) => (
                                  <option key={t.team.id} value={t.team.id}>
                                    {t.team.code} {t.team.name} · {t.club || (t.team.participantType === "kiet" ? t.team.department : t.team.institution)}
                                  </option>
                                ))}
                            </optgroup>
                          </Select>
                        )}
                      </td>
                      <td className={`${tdClass} text-xs`}>
                        {team ? (team.octonorm ? `Octonorm ${team.octonorm}` : "No octonorm") : "—"}
                        {r.heldBy && (!team || r.heldBy !== team.team.code) && <span className="block text-accent-600">{r.octonorm} held by {r.heldBy}</span>}
                      </td>
                      <td className={`${tdClass} text-xs`}>
                        {r.status === "not_in_finale" ? (
                          <Pill tone="red">Not in the Grand Finale</Pill>
                        ) : !picked ? (
                          <Pill tone="orange">Choose the team</Pill>
                        ) : inPlace ? (
                          <Pill tone="green">In place</Pill>
                        ) : (
                          <Pill tone="cyan">Will change</Pill>
                        )}
                        {r.note && <span className="mt-1 block text-muted">{r.note}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableFrame>
          </>
        )}
      </div>
    </Dialog>
  );
}
