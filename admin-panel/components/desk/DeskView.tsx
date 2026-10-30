"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Download, IdCard, RefreshCw, Save, Ticket, UserCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { DeskMember, DeskTeam, RegistrationInput } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { downloadWorkbook, sheet } from "@/lib/excel";
import { categoryTitle, formatDateTime, formatTime, plural, typeShortLabels, typeTones } from "@/lib/format";
import { yearLabel } from "@/lib/rules";
import { useQuery } from "@/lib/use-query";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { TableFrame, tdClass, Th } from "@/components/ui/Table";

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const octonormOrder = (a: DeskTeam, b: DeskTeam) => (a.tent === null) !== (b.tent === null) ? (a.tent === null ? 1 : -1) : natural(a.tent ?? "", b.tent ?? "") || natural(a.code, b.code);

/** "154 · DPS Team (IT26-0006)" for the team picker. */
const teamLabel = (t: DeskTeam) => `${t.tent ? `${t.tent} · ` : "No octonorm · "}${t.name} (${t.code})`;

/** What a student is told and the desk records: here, ID card, lunch coupon. */
type Row = { present: boolean; idCard: boolean; coupon: boolean };
const onRecord = (m: DeskMember): Row => ({ present: m.checkedInAt !== null, idCard: m.idCardAt !== null, coupon: m.couponAt !== null });

/**
 * The Grand Finale registration desk, at the entrance of the ground. Pick the team (every finale team is in the list),
 * tick who of them is here, and record the paper ID card and lunch coupon handed to each. Only a student who is here gets
 * either. Registering is the student's Grand Finale attendance, and it shows them their octonorm on their dashboard.
 */
export function DeskView({ embedded = false }: { embedded?: boolean }) {
  const admin = useAdmin();
  const desk = useQuery("desk", () => api.desk());
  const all = useQuery("desk-teams", () => api.deskExport());
  const [picked, setPicked] = useState("");
  const [filter, setFilter] = useState("");
  const [updates, setUpdates] = useState<Record<string, DeskTeam>>({});
  // Kept here, not in the team's card: the card is drawn again from the saved data, which would drop its message.
  const [saved, setSaved] = useState<{ teamId: string; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Several desks work at once: refresh the totals and the list now and then.
  const { reload: reloadDesk } = desk;
  const { reload: reloadTeams } = all;
  useEffect(() => {
    const timer = setInterval(() => {
      reloadDesk();
      reloadTeams();
    }, 30_000);
    return () => clearInterval(timer);
  }, [reloadDesk, reloadTeams]);

  const teams = useMemo(() => (all.data ?? []).map((t) => updates[t.id] ?? t).sort(octonormOrder), [all.data, updates]);
  const q = filter.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const matching = q
    ? teams.filter(
        (t) =>
          [t.tent ?? "", t.code, t.name, t.institution, t.place].some((v) => v.toLowerCase().includes(q)) ||
          t.members.some((m) => m.fullName.toLowerCase().includes(q) || m.rollNumber.toLowerCase().includes(q) || (digits.length === 4 && m.phone.endsWith(digits))),
      )
    : teams;
  // A search that leaves one team opens it straight away.
  const team = teams.find((t) => t.id === picked) ?? (q && matching.length === 1 ? matching[0] : undefined);

  function updated(next: DeskTeam) {
    setUpdates((current) => ({ ...current, [next.id]: next }));
    const here = next.members.filter((m) => m.checkedInAt).length;
    setSaved({ teamId: next.id, text: `Saved: ${here} of ${plural(next.members.length, "student")} of ${next.name} registered.` });
    desk.reload();
  }

  async function exportAll() {
    setExporting(true);
    setExportError(null);
    try {
      const rows = (await api.deskExport()).sort(octonormOrder).flatMap((t) => t.members.map((member) => ({ team: t, member })));
      type R = (typeof rows)[number];
      await downloadWorkbook("finale-registration", [
        sheet(
          "Registration",
          [
            { header: "Octonorm", width: 10, value: (r: R) => r.team.tent ?? "", text: true },
            { header: "Building / room", width: 22, value: (r: R) => r.team.place },
            { header: "Team code", width: 12, value: (r: R) => r.team.code, text: true },
            { header: "Team", width: 28, value: (r: R) => r.team.name },
            { header: "Category", width: 9, value: (r: R) => r.team.category },
            { header: "From", width: 34, value: (r: R) => (r.team.participantType === "kiet" ? `KIET ${r.team.department ?? ""}`.trim() : r.team.institution) },
            { header: "Student", width: 28, value: (r: R) => r.member.fullName },
            { header: "Role", width: 8, value: (r: R) => r.member.role },
            { header: "Roll number", width: 18, value: (r: R) => r.member.rollNumber, text: true },
            { header: "Registered", width: 20, value: (r: R) => (r.member.checkedInAt ? formatDateTime(r.member.checkedInAt) : "") },
            { header: "Registered by", width: 28, value: (r: R) => r.member.checkedInBy ?? "" },
            { header: "ID card", width: 10, value: (r: R) => (r.member.idCardAt ? formatTime(r.member.idCardAt) : "") },
            { header: "Lunch coupon", width: 12, value: (r: R) => (r.member.couponAt ? formatTime(r.member.couponAt) : "") },
          ],
          rows,
        ),
      ]);
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const data = desk.data;
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={embedded ? undefined : "Grand Finale · 30 October"}
        title="Registration desk"
        description="Pick the team, tick every student who is here and the ID card and lunch coupon you hand each of them, then save. Only a student who is here gets an ID card and a coupon. Registered students then see their octonorm on their dashboard."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                desk.reload();
                all.reload();
              }}
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={exportAll} pending={exporting} disabled={!all.data}>
              {!exporting && <Download aria-hidden="true" className="size-3.5" />}
              Download (Excel)
            </Button>
          </>
        }
      />
      {exportError && <Notice tone="error">{exportError}</Notice>}
      {desk.error && <Notice tone="error">{desk.error}</Notice>}

      {data && (
        <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat Icon={UserCheck} label="Teams registered" value={data.teamsCheckedIn} of={data.teams} />
          <Stat Icon={BadgeCheck} label="Students registered" value={data.studentsCheckedIn} of={data.students} />
          <Stat Icon={IdCard} label="ID cards given" value={data.idCards} of={data.studentsCheckedIn} />
          <Stat Icon={Ticket} label="Lunch coupons given" value={data.coupons} of={data.studentsCheckedIn} />
        </section>
      )}

      <section aria-labelledby="find-title" className="space-y-3">
        <SectionTitle id="find-title" title="Team" meta={all.data ? plural(teams.length, "Grand Finale team") : undefined} />
        {all.error && <Notice tone="error">{all.error}</Notice>}
        {!all.data && !all.error && <Loading label="Loading the Grand Finale teams" />}
        {all.data && (
          <div className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-line md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Field label="Search" htmlFor="desk-filter" hint="Octonorm, team code or name, a student's name or roll number, or the last 4 digits of a phone">
              <Input id="desk-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e.g. 154, IT26-0217, Aarav" autoComplete="off" />
            </Field>
            <Field label={`Choose the team${q ? ` (${matching.length} match)` : ""}`} htmlFor="desk-team">
              <Select id="desk-team" value={team?.id ?? ""} onChange={(e) => setPicked(e.target.value)}>
                <option value="">Choose a team…</option>
                {matching.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teamLabel(t)}
                    {t.members.some((m) => m.checkedInAt) ? " ✓" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {all.data && q && matching.length === 0 && (
          <EmptyState title="No Grand Finale team matches">Check the octonorm, code or spelling. Teams not taking part in the Grand Finale are not listed: send them to the help desk.</EmptyState>
        )}
        {team && saved?.teamId === team.id && <Notice tone="success">{saved.text}</Notice>}
        {team && (
          <TeamCard
            key={`${team.id}:${team.members.map((m) => `${m.checkedInAt}${m.idCardAt}${m.couponAt}`).join()}`}
            team={team}
            onUpdated={updated}
            onChange={() => setSaved(null)}
          />
        )}
      </section>
      <p className="text-xs text-muted">Signed in as {admin.email}. Every registration, ID card and coupon is recorded with your email.</p>
    </div>
  );
}

/** The student's year (class at a school), and branch (department; a COE KIET student gives the club instead). */
const memberYear = (m: DeskMember) => (m.participantType === "startup" ? "" : yearLabel(m.year, m.participantType));
const memberBranch = (m: DeskMember) => (m.participantType === "kiet" && m.department && m.department !== "COE" ? m.department : "");
/** Where the student is from: KIET (and the club), or their college, school or startup. */
const memberFrom = (m: DeskMember) => (m.club ? `${m.institution || "KIET"} · ${m.club}` : m.institution || (m.participantType === "kiet" ? "KIET" : "—"));

function Stat({ Icon, label, value, of }: { Icon: typeof UserCheck; label: string; value: number; of: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        <Icon aria-hidden="true" className="size-4 text-brand-600" />
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-navy-900">
        {value}
        <span className="text-sm font-semibold text-muted"> / {of}</span>
      </p>
    </div>
  );
}

function TeamCard({ team, onUpdated, onChange }: { team: DeskTeam; onUpdated: (team: DeskTeam) => void; onChange: () => void }) {
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(team.members.map((m) => [m.userId, onRecord(m)])));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = team.members.filter((m) => {
    const a = rows[m.userId];
    const b = onRecord(m);
    return a.present !== b.present || a.idCard !== b.idCard || a.coupon !== b.coupon;
  });

  function set(userId: string, change: Partial<Row>) {
    onChange();
    setRows((current) => {
      const next = { ...current[userId], ...change };
      // Not here: no ID card and no coupon.
      if (!next.present) Object.assign(next, { idCard: false, coupon: false });
      return { ...current, [userId]: next };
    });
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const members: RegistrationInput[] = team.members.map((m) => ({ userId: m.userId, ...rows[m.userId] }));
      onUpdated(await api.deskRegister(team.id, members));
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <header className="flex flex-wrap items-start gap-4 border-b border-line p-4 sm:p-5">
        <div className="grid min-w-24 place-items-center rounded-2xl bg-navy-900 px-4 py-3 text-white">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Octonorm</span>
          <span className="font-display text-4xl font-bold tabular-nums leading-none">{team.tent ?? "—"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-bold text-navy-900">{team.name}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {team.code} · Category {team.category}: {categoryTitle(team.category)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone={typeTones[team.participantType]}>{team.participantType === "kiet" ? `KIET ${team.department ?? ""}` : typeShortLabels[team.participantType]}</Pill>
            {team.participantType !== "kiet" && <span className="text-sm text-navy-800">{team.institution}</span>}
          </div>
          {team.place && <p className="mt-2 text-sm font-semibold text-accent-600">Exhibits at {team.place}{team.tent ? ` (octonorm ${team.tent})` : ""}</p>}
          {!team.tent && !team.place && <p className="mt-2 text-sm font-semibold text-accent-600">No octonorm yet: send them to the help desk.</p>}
        </div>
      </header>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => team.members.forEach((m) => !m.banned && set(m.userId, { present: true, idCard: true, coupon: true }))}
          >
            Everyone here: ID card and coupon to all
          </Button>
        </div>
        <TableFrame label={`Students of ${team.name}`} minWidth="min-w-[720px]">
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>Roll number · phone</Th>
              <Th className="text-center">Here</Th>
              <Th className="text-center">ID card</Th>
              <Th className="text-center">Lunch coupon</Th>
              <Th>Registered</Th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((m) => {
              const row = rows[m.userId];
              return (
                <tr key={m.userId} className={row.present ? "bg-emerald-50/60" : ""}>
                  <td className={tdClass}>
                    <span className="font-semibold text-navy-900">{m.fullName}</span>
                    <span className="block text-xs text-muted">{[m.role === "leader" ? "Leader" : "", memberYear(m), m.course, memberBranch(m)].filter(Boolean).join(" · ")}</span>
                    <span className="block text-xs font-medium text-navy-800">{memberFrom(m)}</span>
                    {m.banned && <span className="mt-0.5 block text-xs font-semibold text-red-700">Suspended: send to the help desk</span>}
                  </td>
                  <td className={`${tdClass} font-mono text-xs`}>
                    {m.rollNumber || "—"}
                    <span className="block text-muted">{m.phone}</span>
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <Checkbox label={`${m.fullName} is here`} checked={row.present} disabled={m.banned || pending} onChange={(on) => set(m.userId, { present: on })} />
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <Checkbox label={`ID card given to ${m.fullName}`} checked={row.idCard} disabled={!row.present || pending} onChange={(on) => set(m.userId, { idCard: on })} />
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <Checkbox label={`Lunch coupon given to ${m.fullName}`} checked={row.coupon} disabled={!row.present || pending} onChange={(on) => set(m.userId, { coupon: on })} />
                  </td>
                  <td className={`${tdClass} text-xs text-muted`}>{m.checkedInAt ? `${formatTime(m.checkedInAt)} · ${m.checkedInBy}` : "Not yet"}</td>
                </tr>
              );
            })}
          </tbody>
        </TableFrame>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          {error && <p role="alert" className="mr-auto text-sm font-medium text-red-700">{error}</p>}
          <Button onClick={save} pending={pending} disabled={changed.length === 0}>
            {!pending && <Save aria-hidden="true" className="size-4" />}
            {changed.length ? `Save (${plural(changed.length, "change")})` : "Saved"}
          </Button>
        </div>
      </div>
    </article>
  );
}
