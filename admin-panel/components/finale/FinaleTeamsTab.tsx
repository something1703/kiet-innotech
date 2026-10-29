"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Hash, MapPin, Pencil, Shapes, Sparkles, Undo2, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { Finale, FinaleEntryInput, FinaleSection, FinaleTeam } from "@/lib/admin-types";
import { categories, departmentLabel, departments } from "@/lib/content";
import { downloadWorkbook, sheet } from "@/lib/excel";
import { categoryTitle, plural, typeShortLabels, typeTones } from "@/lib/format";
import { teamHref } from "@/lib/routes";
import { AddCompleteTeamDialog } from "@/components/teams/AddCompleteTeamDialog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { TableFrame, tdClass, Th } from "@/components/ui/Table";

export const sectionTones: Record<FinaleSection, PillTone> = { category: "navy", coe: "violet", club: "violet", school: "cyan", college: "cyan", startup: "orange" };
const sectionOrder: FinaleSection[] = ["category", "coe", "club", "college", "startup", "school"];

const cleanOctonorm = (value: string) => value.replace(/\s+/g, "").toUpperCase();
/** The number in an octonorm label, for ranges: "154" -> 154, "S-12" -> 12. */
export const octonormNumber = (value: string | null) => {
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : null;
};
export const placeLabel = (t: { building: string; room: string }) => [t.building, t.room ? `Room ${t.room}` : ""].filter(Boolean).join(" · ");
const fromLabel = (t: FinaleTeam) => (t.team.participantType === "kiet" ? `KIET ${t.team.department ?? ""}`.trim() : t.team.institution);

/** A team's full entry, with a change applied: what the server saves. */
function entry(t: FinaleTeam, patch: Partial<FinaleEntryInput> = {}): FinaleEntryInput {
  return {
    teamId: t.team.id,
    octonorm: t.octonorm,
    building: t.building,
    room: t.room,
    section: t.section === t.defaultSection ? null : t.section,
    ...patch,
  };
}

type Filters = {
  q: string;
  section: string;
  category: string;
  type: string;
  department: string;
  from: string;
  to: string;
  place: string;
  registration: string;
  panel: string;
  scored: string;
  wildcard: boolean;
};
const noFilters: Filters = { q: "", section: "", category: "", type: "", department: "", from: "", to: "", place: "", registration: "", panel: "", scored: "", wildcard: false };

function matches(t: FinaleTeam, f: Filters) {
  const q = f.q.trim().toLowerCase();
  if (q && ![t.octonorm ?? "", t.team.code, t.team.name, t.team.leaderName, t.team.institution, t.team.projectTitle, placeLabel(t)].some((v) => v.toLowerCase().includes(q))) return false;
  if (f.section && t.section !== f.section) return false;
  if (f.category && t.team.category !== Number(f.category)) return false;
  if (f.type && t.team.participantType !== f.type) return false;
  if (f.department && t.team.department !== f.department) return false;
  const n = octonormNumber(t.octonorm);
  if ((f.from || f.to) && n === null) return false;
  if (f.from && n !== null && n < Number(f.from)) return false;
  if (f.to && n !== null && n > Number(f.to)) return false;
  if (f.place === "none" && (t.octonorm || t.building || t.room)) return false;
  if (f.place === "octonorm" && (!t.octonorm || t.building || t.room)) return false;
  if (f.place === "room" && !(t.building || t.room)) return false;
  if (f.registration === "none" && t.registered > 0) return false;
  if (f.registration === "some" && !(t.registered > 0 && t.registered < t.members)) return false;
  if (f.registration === "all" && t.registered < t.members) return false;
  if (f.panel === "none" && t.panelId) return false;
  if (f.panel && f.panel !== "none" && t.panelId !== f.panel) return false;
  const complete = t.judges > 0 && t.scores >= t.judges;
  if (f.scored === "complete" && !complete) return false;
  if (f.scored === "partial" && (complete || t.scores === 0)) return false;
  if (f.scored === "none" && t.scores > 0) return false;
  if (f.wildcard && !t.wildcard) return false;
  return true;
}

/** Every Grand Finale team: filter on anything, give octonorms, move teams to a building and room, change sections. */
export function FinaleTeamsTab({ finale, onSaved, reload }: { finale: Finale; onSaved: (data: Finale) => void; reload: () => void }) {
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<FinaleTeam | null>(null);
  const [bulk, setBulk] = useState<"place" | "section" | "number" | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const shown = finale.teams.filter((t) => matches(t, filters));
  const selected = finale.teams.filter((t) => chosen.has(t.team.id));
  const filtered = JSON.stringify(filters) !== JSON.stringify(noFilters);
  const panels = [...new Map(finale.teams.filter((t) => t.panelId).map((t) => [t.panelId as string, t.panel ?? ""])).entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
  const toggle = (id: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function save(entries: FinaleEntryInput[], done: string) {
    if (entries.length === 0) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      onSaved(await api.saveFinaleEntries(entries));
      setMessage(done);
      setEditing(null);
      setBulk(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function exportShown() {
    await downloadWorkbook("grand-finale-teams", [
      sheet(
        "Grand Finale teams",
        [
          { header: "Octonorm", width: 10, value: (t: FinaleTeam) => t.octonorm ?? "", text: true },
          { header: "Building / room", width: 22, value: (t: FinaleTeam) => placeLabel(t) },
          { header: "Team code", width: 12, value: (t: FinaleTeam) => t.team.code, text: true },
          { header: "Team", width: 28, value: (t: FinaleTeam) => t.team.name },
          { header: "Section", width: 30, value: (t: FinaleTeam) => finale.sections[t.section] },
          { header: "Category", width: 9, value: (t: FinaleTeam) => t.team.category },
          { header: "From", width: 34, value: (t: FinaleTeam) => fromLabel(t) },
          { header: "Leader", width: 26, value: (t: FinaleTeam) => t.team.leaderName },
          { header: "Project", width: 40, value: (t: FinaleTeam) => t.team.projectTitle },
          { header: "Wild card", width: 10, value: (t: FinaleTeam) => (t.wildcard ? "Yes" : "") },
          { header: "Panel", width: 18, value: (t: FinaleTeam) => t.panel ?? "" },
          { header: "Marks in", width: 10, value: (t: FinaleTeam) => (t.judges ? `${t.scores}/${t.judges}` : "") },
          { header: "Members", width: 9, value: (t: FinaleTeam) => t.members },
          { header: "Registered", width: 11, value: (t: FinaleTeam) => t.registered },
          { header: "ID cards", width: 9, value: (t: FinaleTeam) => t.idCards },
          { header: "Lunch coupons", width: 13, value: (t: FinaleTeam) => t.coupons },
        ],
        shown,
      ),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted">
          Every team at the Grand Finale. Each gets its octonorm number; a super admin can move one (or a whole range) to a building and room
          instead, and change the section a team is ranked in. Students see their octonorm only after the registration desk registers them.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportShown} disabled={shown.length === 0}>
            <Download aria-hidden="true" className="size-3.5" />
            Download {filtered ? "shown" : "all"} (Excel)
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Sparkles aria-hidden="true" className="size-3.5" />
            Add wild card team
          </Button>
        </div>
      </div>

      <section aria-label="Filters" className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Field label="Search" htmlFor="ft-q" className="sm:col-span-2">
          <Input id="ft-q" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Octonorm, code, team, leader, college, room" />
        </Field>
        <Field label="Section" htmlFor="ft-section">
          <Select id="ft-section" value={filters.section} onChange={(e) => set({ section: e.target.value })}>
            <option value="">All sections</option>
            {sectionOrder.map((s) => (
              <option key={s} value={s}>
                {finale.sections[s]} ({finale.teams.filter((t) => t.section === s).length})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="ft-category">
          <Select id="ft-category" value={filters.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.number} value={c.number}>
                {c.number}. {c.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type" htmlFor="ft-type">
          <Select id="ft-type" value={filters.type} onChange={(e) => set({ type: e.target.value })}>
            <option value="">All types</option>
            {(["kiet", "college", "school", "startup"] as const).map((t) => (
              <option key={t} value={t}>
                {typeShortLabels[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="KIET department" htmlFor="ft-department">
          <Select id="ft-department" value={filters.department} onChange={(e) => set({ department: e.target.value })}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {departmentLabel(d)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Octonorm from" htmlFor="ft-from">
          <Input id="ft-from" inputMode="numeric" value={filters.from} onChange={(e) => set({ from: e.target.value.replace(/\D/g, "") })} placeholder="e.g. 3" />
        </Field>
        <Field label="Octonorm to" htmlFor="ft-to">
          <Input id="ft-to" inputMode="numeric" value={filters.to} onChange={(e) => set({ to: e.target.value.replace(/\D/g, "") })} placeholder="e.g. 24" />
        </Field>
        <Field label="Where" htmlFor="ft-place">
          <Select id="ft-place" value={filters.place} onChange={(e) => set({ place: e.target.value })}>
            <option value="">Anywhere</option>
            <option value="octonorm">At its octonorm</option>
            <option value="room">In a building / room</option>
            <option value="none">No octonorm or room yet</option>
          </Select>
        </Field>
        <Field label="Registration" htmlFor="ft-registration">
          <Select id="ft-registration" value={filters.registration} onChange={(e) => set({ registration: e.target.value })}>
            <option value="">Any</option>
            <option value="none">Nobody registered</option>
            <option value="some">Some registered</option>
            <option value="all">Everyone registered</option>
          </Select>
        </Field>
        <Field label="Panel" htmlFor="ft-panel">
          <Select id="ft-panel" value={filters.panel} onChange={(e) => set({ panel: e.target.value })}>
            <option value="">Any panel</option>
            <option value="none">No panel yet</option>
            {panels.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Marks" htmlFor="ft-scored">
          <Select id="ft-scored" value={filters.scored} onChange={(e) => set({ scored: e.target.value })}>
            <option value="">Any</option>
            <option value="complete">Marked by every judge</option>
            <option value="partial">Partly marked</option>
            <option value="none">No marks yet</option>
          </Select>
        </Field>
        <div className="flex items-end gap-3 pb-2 sm:col-span-2 lg:col-span-1">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-navy-800">
            <Checkbox label="Wild cards only" checked={filters.wildcard} onChange={(on) => set({ wildcard: on })} />
            Wild cards only
          </label>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(noFilters)}>
              <X aria-hidden="true" className="size-3.5" />
              Clear
            </Button>
          )}
        </div>
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      {message && !error && <Notice tone="success">{message}</Notice>}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-3 py-2 ring-1 ring-line">
        <span className="text-sm font-semibold text-navy-900">
          {plural(shown.length, "team")} shown{selected.length ? ` · ${selected.length} selected` : ""}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setChosen(new Set([...chosen, ...shown.map((t) => t.team.id)]))} disabled={shown.length === 0}>
          Select all shown
        </Button>
        {selected.length > 0 && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setChosen(new Set())}>
              Clear selection
            </Button>
            <span className="flex-1" />
            <Button size="sm" variant="secondary" onClick={() => setBulk("place")}>
              <MapPin aria-hidden="true" className="size-3.5" />
              Move to a building / room
            </Button>
            <Button
              size="sm"
              variant="secondary"
              pending={pending}
              onClick={() => save(selected.map((t) => entry(t, { building: "", room: "" })), `${plural(selected.length, "team")} back at their octonorms.`)}
            >
              <Undo2 aria-hidden="true" className="size-3.5" />
              Back to their octonorm
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulk("section")}>
              <Shapes aria-hidden="true" className="size-3.5" />
              Set section
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulk("number")}>
              <Hash aria-hidden="true" className="size-3.5" />
              Number octonorms
            </Button>
          </>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState title={finale.teams.length ? "No team matches these filters" : "No Grand Finale teams yet"}>
          {finale.teams.length ? "Clear a filter to see more teams." : "Teams appear once the finalist list is locked and other teams are accepted."}
        </EmptyState>
      ) : (
        <TableFrame label="Grand Finale teams" minWidth="min-w-[960px]">
          <thead>
            <tr>
              <Th className="w-10">
                <Checkbox
                  label="Select every team shown"
                  checked={shown.every((t) => chosen.has(t.team.id))}
                  indeterminate={shown.some((t) => chosen.has(t.team.id))}
                  onChange={(on) => shown.forEach((t) => toggle(t.team.id, on))}
                />
              </Th>
              <Th className="w-24">Octonorm</Th>
              <Th>Team</Th>
              <Th>Section</Th>
              <Th>From</Th>
              <Th>Panel · marks</Th>
              <Th>Registered</Th>
              <Th className="w-16">
                <span className="sr-only">Edit</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => {
              const complete = t.judges > 0 && t.scores >= t.judges;
              return (
                <tr key={t.team.id} className={chosen.has(t.team.id) ? "bg-brand-50/70" : ""}>
                  <td className={tdClass}>
                    <Checkbox label={`Select ${t.team.name}`} checked={chosen.has(t.team.id)} onChange={(on) => toggle(t.team.id, on)} />
                  </td>
                  <td className={tdClass}>
                    <span className="font-display text-xl font-bold tabular-nums text-navy-900">{t.octonorm ?? "—"}</span>
                    {(t.building || t.room) && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-accent-600">
                        <MapPin aria-hidden="true" className="size-3" />
                        {placeLabel(t)}
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <Link href={teamHref(t.team.id)} className="font-semibold text-navy-900 hover:underline">
                      {t.team.name}
                    </Link>
                    {t.wildcard && (
                      <span className="ml-2">
                        <Pill tone="orange">Wild card</Pill>
                      </span>
                    )}
                    <span className="block text-xs text-muted">
                      {t.team.code} · {t.team.leaderName}
                    </span>
                    <span className="block max-w-[18rem] truncate text-xs text-navy-800" title={t.team.projectTitle}>
                      {t.team.projectTitle}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <Pill tone={sectionTones[t.section]}>{t.section === "category" ? `Category ${t.team.category}` : finale.sections[t.section]}</Pill>
                    <span className="mt-0.5 block text-xs text-muted" title={categoryTitle(t.team.category)}>
                      {t.section !== t.defaultSection ? `Moved from ${finale.sections[t.defaultSection]}` : t.section === "category" ? categoryTitle(t.team.category) : `Category ${t.team.category}`}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <Pill tone={typeTones[t.team.participantType]}>{typeShortLabels[t.team.participantType]}</Pill>
                    <span className="mt-0.5 block max-w-[14rem] truncate text-xs text-muted">{fromLabel(t)}</span>
                  </td>
                  <td className={tdClass}>
                    {t.panel ? (
                      <>
                        <span className="font-semibold text-navy-900">{t.panel}</span>
                        <span className={`block text-xs font-semibold ${complete ? "text-emerald-700" : t.scores ? "text-accent-600" : "text-muted"}`}>
                          {t.scores}/{t.judges} marks in
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-accent-600">No panel yet</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-xs`}>
                    <span className={`font-display text-base font-bold tabular-nums ${t.registered === t.members ? "text-emerald-700" : t.registered ? "text-accent-600" : "text-muted"}`}>
                      {t.registered}/{t.members}
                    </span>
                    <span className="block text-muted">
                      {t.idCards} ID · {t.coupons} coupon{t.coupons === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                      <Pencil aria-hidden="true" className="size-3.5" />
                      <span className="sr-only">Edit {t.team.name}</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableFrame>
      )}

      {editing && <EditDialog team={editing} finale={finale} pending={pending} error={error} onClose={() => (setEditing(null), setError(null))} onSave={(e) => save([e], `${editing.team.name} saved.`)} />}
      {bulk === "place" && (
        <PlaceDialog
          count={selected.length}
          pending={pending}
          error={error}
          onClose={() => (setBulk(null), setError(null))}
          onSave={(building, room) => save(selected.map((t) => entry(t, { building, room })), `${plural(selected.length, "team")} moved to ${placeLabel({ building, room })}.`)}
        />
      )}
      {bulk === "section" && (
        <SectionDialog
          finale={finale}
          count={selected.length}
          pending={pending}
          error={error}
          onClose={() => (setBulk(null), setError(null))}
          onSave={(section) =>
            save(
              selected.map((t) => entry(t, { section: section === t.defaultSection ? null : section })),
              `${plural(selected.length, "team")} now in ${finale.sections[section]}.`,
            )
          }
        />
      )}
      {bulk === "number" && (
        <NumberDialog
          teams={shown.filter((t) => chosen.has(t.team.id))}
          pending={pending}
          error={error}
          onClose={() => (setBulk(null), setError(null))}
          onSave={(entries) => save(entries, `${plural(entries.length, "octonorm")} given.`)}
        />
      )}
      {adding && (
        <AddCompleteTeamDialog
          wildcard
          onClose={() => setAdding(false)}
          onCreated={(team) => {
            setAdding(false);
            setMessage(`${team.name} (${team.code}) joins the Grand Finale as a wild card.`);
            reload();
          }}
        />
      )}
    </div>
  );
}

function SaveFooter({ pending, onClose, onSave, label = "Save" }: { pending: boolean; onClose: () => void; onSave: () => void; label?: string }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
      <Button onClick={onSave} pending={pending}>
        {label}
      </Button>
    </>
  );
}

function EditDialog({
  team,
  finale,
  pending,
  error,
  onClose,
  onSave,
}: {
  team: FinaleTeam;
  finale: Finale;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (entry: FinaleEntryInput) => void;
}) {
  const [octonorm, setOctonorm] = useState(team.octonorm ?? "");
  const [building, setBuilding] = useState(team.building);
  const [room, setRoom] = useState(team.room);
  const [section, setSection] = useState<FinaleSection>(team.section);
  return (
    <Dialog
      title={`${team.team.name} (${team.team.code})`}
      description="Its octonorm, where it exhibits if not at the octonorm, and the section it is ranked in."
      onClose={onClose}
      busy={pending}
      footer={
        <SaveFooter
          pending={pending}
          onClose={onClose}
          onSave={() =>
            onSave(entry(team, { octonorm: cleanOctonorm(octonorm) || null, building: building.trim(), room: room.trim(), section: section === team.defaultSection ? null : section }))
          }
        />
      }
    >
      <div className="space-y-4">
        <Field label="Octonorm" htmlFor="fe-octonorm" hint="One team per octonorm. Leave empty to take it away.">
          <Input id="fe-octonorm" value={octonorm} onChange={(e) => setOctonorm(e.target.value)} maxLength={12} className="font-mono text-lg font-bold" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Building" htmlFor="fe-building" hint="Only if it is not at its octonorm.">
            <Input id="fe-building" value={building} onChange={(e) => setBuilding(e.target.value)} maxLength={60} placeholder="e.g. B Block" />
          </Field>
          <Field label="Room" htmlFor="fe-room">
            <Input id="fe-room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} placeholder="e.g. 204" />
          </Field>
        </div>
        <Field label="Ranked in" htmlFor="fe-section">
          <Select id="fe-section" value={section} onChange={(e) => setSection(e.target.value as FinaleSection)}>
            {sectionOrder.map((s) => (
              <option key={s} value={s}>
                {finale.sections[s]}
                {s === team.defaultSection ? " (its own)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}

function PlaceDialog({ count, pending, error, onClose, onSave }: { count: number; pending: boolean; error: string | null; onClose: () => void; onSave: (building: string, room: string) => void }) {
  const [building, setBuilding] = useState("");
  const [room, setRoom] = useState("");
  return (
    <Dialog
      title={`Move ${plural(count, "team")} to a building and room`}
      description="They keep their octonorm numbers; students, judges and the desk see the building and room."
      onClose={onClose}
      busy={pending}
      footer={<SaveFooter pending={pending} onClose={onClose} onSave={() => onSave(building.trim(), room.trim())} label="Move" />}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Building" htmlFor="fp-building">
          <Input id="fp-building" value={building} onChange={(e) => setBuilding(e.target.value)} maxLength={60} placeholder="e.g. B Block" />
        </Field>
        <Field label="Room" htmlFor="fp-room">
          <Input id="fp-room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} placeholder="e.g. 204" />
        </Field>
      </div>
      {!building.trim() && !room.trim() && <p className="mt-3 text-sm text-muted">Enter a building, a room, or both.</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </Dialog>
  );
}

function SectionDialog({ finale, count, pending, error, onClose, onSave }: { finale: Finale; count: number; pending: boolean; error: string | null; onClose: () => void; onSave: (section: FinaleSection) => void }) {
  const [section, setSection] = useState<FinaleSection>("club");
  return (
    <Dialog
      title={`Section for ${plural(count, "team")}`}
      description="The section they are ranked in on the Grand Finale leaderboard. Each section names its own 1st and 2nd."
      onClose={onClose}
      busy={pending}
      footer={<SaveFooter pending={pending} onClose={onClose} onSave={() => onSave(section)} />}
    >
      <Field label="Ranked in" htmlFor="fs-section">
        <Select id="fs-section" value={section} onChange={(e) => setSection(e.target.value as FinaleSection)}>
          {sectionOrder.map((s) => (
            <option key={s} value={s}>
              {finale.sections[s]}
            </option>
          ))}
        </Select>
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
    </Dialog>
  );
}

/** Gives the selected teams consecutive octonorms, in the order shown, from a starting number. */
function NumberDialog({ teams, pending, error, onClose, onSave }: { teams: FinaleTeam[]; pending: boolean; error: string | null; onClose: () => void; onSave: (entries: FinaleEntryInput[]) => void }) {
  const [start, setStart] = useState(String(octonormNumber(teams[0]?.octonorm ?? null) ?? ""));
  const first = Number(start);
  const valid = start !== "" && Number.isInteger(first) && first > 0;
  return (
    <Dialog
      title={`Number ${plural(teams.length, "team")}`}
      description="In the order the list shows them. Octonorms already held by other teams are refused, so nothing changes by mistake."
      onClose={onClose}
      busy={pending}
      footer={
        <SaveFooter pending={pending} onClose={onClose} onSave={() => valid && onSave(teams.map((t, i) => entry(t, { octonorm: String(first + i) })))} label="Give octonorms" />
      }
    >
      <Field label="First octonorm" htmlFor="fn-start" hint={valid ? `${teams.length > 1 ? `${first} to ${first + teams.length - 1}` : String(first)}` : "A whole number, e.g. 3"}>
        <Input id="fn-start" inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value.replace(/\D/g, ""))} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
    </Dialog>
  );
}
