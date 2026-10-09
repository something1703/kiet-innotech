"use client";

import Link from "next/link";
import { useState } from "react";
import { Crown, MapPin, Pencil, Plus, Trash2, UserCog, Users } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { Judging, Juror, Panel, TeamSummary } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { categories, departmentLabel, departments } from "@/lib/content";
import { categoryTitle, plural } from "@/lib/format";
import { teamHref } from "@/lib/routes";
import { useQuery } from "@/lib/use-query";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { Pill } from "@/components/ui/Pill";
import { numClass, TableFrame, tdClass, Th } from "@/components/ui/Table";
import { YearChips } from "@/components/teams/YearChips";
import { AttendanceButtons } from "./AttendanceButtons";

export function PanelsTab({ judging, reload }: { judging: Judging; reload: () => void }) {
  const admin = useAdmin();
  const manage = judging.canManage;
  const round = judging.round.round;
  const isRooms = round === "department";
  const [department, setDepartment] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Panel | null>(null);
  const [allotting, setAllotting] = useState<Panel | null>(null);
  const [staffing, setStaffing] = useState<Panel | null>(null);
  const [deleting, setDeleting] = useState<Panel | null>(null);

  const panels = department ? judging.panels.filter((p) => p.department === department) : judging.panels;
  const waiting = department ? judging.unallotted.filter((t) => t.department === department) : judging.unallotted;
  const waitingByDepartment = Object.entries(
    judging.unallotted.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.department ?? "Other"]: (acc[t.department ?? "Other"] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {isRooms && admin.role === "super_admin" ? (
          <Field label="Department" htmlFor="rooms-department" className="w-56">
            <Select id="rooms-department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{departmentLabel(d)}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          {round === "final" && <AttendanceButtons round="final" label="every finale team" />}
          {manage && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" className="size-4" />
              {isRooms ? "New room" : "New panel"}
            </Button>
          )}
        </div>
      </div>

      {waiting.length > 0 ? (
        <Notice tone="warning" title={`${plural(waiting.length, "team")} not yet allotted to a ${isRooms ? "room" : "panel"}`}>
          {isRooms && !department && waitingByDepartment.length > 1 ? (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {waitingByDepartment.map(([d, count]) => (
                <button key={d} type="button" onClick={() => setDepartment(d)} className="font-semibold text-brand-700 hover:underline">
                  {d}: {count}
                </button>
              ))}
            </span>
          ) : (
            <span>{waiting.slice(0, 12).map((t) => t.code).join(", ")}{waiting.length > 12 ? "…" : ""}</span>
          )}
        </Notice>
      ) : (
        judging.panels.length > 0 && <Notice tone="success">Every eligible team is allotted.</Notice>
      )}

      {panels.length === 0 ? (
        <EmptyState title={isRooms ? "No rooms yet" : "No finale panels yet"}>
          {manage
            ? isRooms
              ? "Create a room for each department's teams, then allot teams and appoint judges from other departments."
              : "Create the finale panels (the plan: 8 panels of 2 external judges), then allot teams and judges."
            : "Organisers have not set up rooms for this round yet."}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {panels.map((panel) => (
            <PanelCard
              key={panel.id}
              panel={panel}
              manage={manage}
              onEdit={() => setEditing(panel)}
              onAllot={() => setAllotting(panel)}
              onStaff={() => setStaffing(panel)}
              onDelete={() => setDeleting(panel)}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PanelFormDialog
          round={round}
          panel={editing}
          defaultDepartment={department}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            reload();
          }}
        />
      )}
      {allotting && (
        <AllotTeamsDialog
          panel={allotting}
          candidates={[...allotting.teams, ...judging.unallotted.filter((t) => round === "final" || t.department === allotting.department)]}
          onClose={() => setAllotting(null)}
          onSaved={() => {
            setAllotting(null);
            reload();
          }}
        />
      )}
      {staffing && (
        <PanelJudgesDialog
          panel={staffing}
          onClose={() => setStaffing(null)}
          onSaved={() => {
            setStaffing(null);
            reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          description="Its teams go back to the unallotted list and its judges are freed. Not possible once any team here has been scored."
          confirmLabel="Delete"
          tone="danger"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deletePanel(deleting.id);
            setDeleting(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PanelCard({
  panel,
  manage,
  onEdit,
  onAllot,
  onStaff,
  onDelete,
}: {
  panel: Panel;
  manage: boolean;
  onEdit: () => void;
  onAllot: () => void;
  onStaff: () => void;
  onDelete: () => void;
}) {
  const final = panel.round === "final";
  const scored = panel.teams.reduce((sum, t) => sum + t.scores, 0);
  const expected = panel.teams.length * panel.jurors.length;
  return (
    <article aria-labelledby={`panel-${panel.id}`} className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 id={`panel-${panel.id}`} className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-navy-900">
            {panel.name}
            {panel.department && <Pill tone="navy">{panel.department} teams</Pill>}
            {expected > 0 && <Pill tone={scored >= expected ? "green" : "slate"}>{scored} / {expected} scores</Pill>}
          </h3>
          {panel.location && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
              <MapPin aria-hidden="true" className="size-3.5" />
              {panel.location}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {panel.jurors.length === 0 ? (
              <span className="text-sm font-medium text-accent-600">No judges appointed yet</span>
            ) : (
              panel.jurors.map((j) => (
                <span key={j.email} className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs ring-1 ring-inset ring-line" title={j.email}>
                  {j.chair && <Crown aria-label="Chair" className="size-3 text-accent-500" />}
                  <span className="font-semibold text-navy-900">{j.name}</span>
                  <span className="text-muted">{j.kind === "faculty" ? j.department : j.organisation}</span>
                </span>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AttendanceButtons round={panel.round} panelId={panel.id} label={panel.name} />
          {manage && (
            <div className="flex flex-wrap justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={onAllot}>
                <Users aria-hidden="true" className="size-3.5" />
                Teams
              </Button>
              <Button size="sm" variant="ghost" onClick={onStaff}>
                <UserCog aria-hidden="true" className="size-3.5" />
                Judges
              </Button>
              <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Rename ${panel.name}`}>
                <Pencil aria-hidden="true" className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="text-red-700" onClick={onDelete} aria-label={`Delete ${panel.name}`}>
                <Trash2 aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </header>
      {panel.teams.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No teams allotted yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {final && <Th>Stall</Th>}
                <Th>Team</Th>
                <Th>Category</Th>
                <Th>Years</Th>
                <Th className={numClass}>Scores</Th>
                <Th className={numClass}>Average /50</Th>
              </tr>
            </thead>
            <tbody>
              {panel.teams.map((team) => (
                <tr key={team.id} className="hover:bg-surface/70">
                  {final && <td className={`${tdClass} font-mono text-xs font-bold`}>{team.tent ?? "—"}</td>}
                  <td className={tdClass}>
                    <Link href={teamHref(team.id)} className="font-semibold text-navy-900 hover:text-brand-700 hover:underline">
                      {team.name}
                    </Link>
                    <span className="block text-xs text-muted">
                      {team.code} · {team.department ?? team.institution}
                      {team.status !== "submitted" && <span className="font-semibold text-red-700"> · {team.status}</span>}
                    </span>
                  </td>
                  <td className={tdClass} title={categoryTitle(team.category)}>
                    <span className="font-display font-bold text-navy-900">{team.category}</span>
                    <span className="ml-1 hidden text-xs text-muted xl:inline">{categoryTitle(team.category)}</span>
                  </td>
                  <td className={tdClass}>
                    <YearChips years={team.memberYears} type={team.participantType} />
                  </td>
                  <td className={`${tdClass} ${numClass}`}>
                    {team.scores} / {panel.jurors.length}
                  </td>
                  <td className={`${tdClass} ${numClass} font-semibold`}>{team.average ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function PanelFormDialog({
  round,
  panel,
  defaultDepartment,
  onClose,
  onSaved,
}: {
  round: Judging["round"]["round"];
  panel: Panel | null;
  defaultDepartment: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(panel?.name ?? "");
  const [location, setLocation] = useState(panel?.location ?? "");
  const [department, setDepartment] = useState(panel?.department ?? defaultDepartment);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isRoom = round === "department";

  async function save() {
    if (name.trim().length < 2) return setError("Give it a name, e.g. “Room 304” or “Panel A”.");
    if (isRoom && !panel && !department) return setError("Choose the department whose teams are judged here.");
    setPending(true);
    setError(null);
    try {
      if (panel) await api.updatePanel(panel.id, { name: name.trim(), location: location.trim() });
      else await api.createPanel({ round, name: name.trim(), location: location.trim(), department: isRoom ? department : null });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      title={panel ? `Rename ${panel.name}` : isRoom ? "New room" : "New finale panel"}
      description={isRoom ? "A room judges one department's teams." : "A finale panel judges the teams you allot to it, usually one or two categories."}
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} pending={pending}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Name" htmlFor="panel-name">
          <Input id="panel-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={isRoom ? "Room 304" : "Panel A · Categories 1 and 2"} />
        </Field>
        <Field label="Location" htmlFor="panel-location" hint="Optional. Printed on the attendance sheet.">
          <Input id="panel-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder={isRoom ? "CSIT block, 3rd floor" : "Main ground, stalls 1 to 12"} />
        </Field>
        {isRoom && !panel && (
          <Field label="Department" htmlFor="panel-department">
            <Select id="panel-department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Choose a department</option>
              {departments.map((d) => (
                <option key={d} value={d}>{departmentLabel(d)}</option>
              ))}
            </Select>
          </Field>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}

function AllotTeamsDialog({ panel, candidates, onClose, onSaved }: { panel: Panel; candidates: TeamSummary[]; onClose: () => void; onSaved: () => void }) {
  const [chosen, setChosen] = useState(() => new Set(panel.teams.map((t) => t.id)));
  const [category, setCategory] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const q = text.trim().toLowerCase();
  const shown = candidates.filter(
    (t) => (!category || t.category === category) && (!q || [t.name, t.code, t.institution, t.leaderName].some((v) => v.toLowerCase().includes(q))),
  );
  const toggle = (id: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function save() {
    setPending(true);
    setError(null);
    try {
      await api.setPanelTeams(panel.id, [...chosen]);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      title={`Teams in ${panel.name}`}
      description={panel.department ? `Submitted ${panel.department} teams not yet in another room.` : "Finalists and teams from other colleges and schools not yet on another panel."}
      onClose={onClose}
      busy={pending}
      size="xl"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-muted">{plural(chosen.size, "team")} selected</span>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} pending={pending}>
            Save allotment
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <Field label="Search" htmlFor="allot-search">
            <Input id="allot-search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Team name, code, leader or institution" />
          </Field>
          <Field label="Category" htmlFor="allot-category">
            <Select id="allot-category" value={category} onChange={(e) => setCategory(Number(e.target.value))}>
              <option value={0}>All categories</option>
              {categories.map((c) => (
                <option key={c.number} value={c.number}>{c.number}. {c.title}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Button size="sm" variant="secondary" onClick={() => shown.forEach((t) => toggle(t.id, true))} disabled={shown.length === 0}>
            Select all shown ({shown.length})
          </Button>
          <Button size="sm" variant="ghost" onClick={() => shown.forEach((t) => toggle(t.id, false))} disabled={shown.length === 0}>
            Clear shown
          </Button>
        </div>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No teams to allot{category || q ? " with these filters" : ""}.</p>
        ) : (
          <TableFrame label="Teams to allot" minWidth="min-w-[640px]">
            <thead>
              <tr>
                <Th className="w-10">
                  <span className="sr-only">Allotted</span>
                </Th>
                <Th>Team</Th>
                <Th>Category</Th>
                <Th>Years</Th>
                <Th>Leader</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className={chosen.has(t.id) ? "bg-brand-50/70" : ""}>
                  <td className={tdClass}>
                    <Checkbox label={`Allot ${t.name}`} checked={chosen.has(t.id)} onChange={(on) => toggle(t.id, on)} />
                  </td>
                  <td className={tdClass}>
                    <span className="font-semibold text-navy-900">{t.name}</span>
                    <span className="block text-xs text-muted">{t.code} · {t.department ?? t.institution}</span>
                  </td>
                  <td className={tdClass}>{t.category}</td>
                  <td className={tdClass}>
                    <YearChips years={t.memberYears} type={t.participantType} />
                  </td>
                  <td className={`${tdClass} text-muted`}>{t.leaderName}</td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}

function conflict(juror: Juror, panel: Panel) {
  return panel.round === "department" && juror.kind === "faculty" && juror.department === panel.department
    ? `From ${juror.department}: faculty judge other departments' teams`
    : null;
}

function PanelJudgesDialog({ panel, onClose, onSaved }: { panel: Panel; onClose: () => void; onSaved: () => void }) {
  const jurors = useQuery("jurors", () => api.listJurors());
  const [chosen, setChosen] = useState(() => new Set(panel.jurors.map((j) => j.email)));
  const [chair, setChair] = useState(panel.jurors.find((j) => j.chair)?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    try {
      await api.setPanelJurors(panel.id, [...chosen].map((email) => ({ email, chair: email === chair })));
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  const list = jurors.data ?? [];
  return (
    <Dialog
      title={`Judges for ${panel.name}`}
      description={
        panel.round === "department"
          ? `Faculty of another department, so not ${panel.department}. Pick one chair; the chair settles ties.`
          : "The plan is two external judges per finale panel. Pick one chair; the chair settles ties."
      }
      onClose={onClose}
      busy={pending}
      size="lg"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-muted">{plural(chosen.size, "judge")} selected</span>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} pending={pending}>
            Save judges
          </Button>
        </>
      }
    >
      {jurors.error && <Notice tone="error">{jurors.error}</Notice>}
      {!jurors.data && !jurors.error && <Loading label="Loading judges" />}
      {jurors.data && list.length === 0 && <EmptyState title="No judges appointed yet">Add judges on the Judges tab first.</EmptyState>}
      {jurors.data && list.length > 0 && (
        <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
          {list.map((j) => {
            const blocked = conflict(j, panel);
            const on = chosen.has(j.email);
            const elsewhere = j.panels.filter((p) => p.id !== panel.id);
            return (
              <li key={j.email} className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 ${blocked ? "opacity-60" : ""}`}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                  <Checkbox
                    label={`Appoint ${j.name}`}
                    checked={on}
                    disabled={!!blocked && !on}
                    onChange={(value) => {
                      setChosen((current) => {
                        const next = new Set(current);
                        if (value) next.add(j.email);
                        else next.delete(j.email);
                        return next;
                      });
                      if (!value && chair === j.email) setChair("");
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy-900">{j.name}</span>
                    <span className="block text-xs text-muted">
                      {j.kind === "faculty" ? `KIET faculty · ${j.department}` : `External · ${j.organisation}`}
                      {elsewhere.length > 0 && ` · also on ${elsewhere.map((p) => p.name).join(", ")}`}
                    </span>
                    {blocked && <span className="block text-xs font-medium text-red-700">{blocked}</span>}
                  </span>
                </label>
                <label className={`flex items-center gap-1.5 text-xs font-semibold ${on ? "text-navy-900" : "text-muted"}`}>
                  <input type="radio" name="chair" className="accent-accent-500" checked={chair === j.email} disabled={!on} onChange={() => setChair(j.email)} />
                  Chair
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
    </Dialog>
  );
}
