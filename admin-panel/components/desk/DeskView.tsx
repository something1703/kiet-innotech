"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CircleCheck, Download, Lock, LockOpen, Plus, RefreshCw, Ticket, Trash2, UserCheck, Utensils } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { Desk, DeskMember, DeskTeam, Meal } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { downloadWorkbook, sheet } from "@/lib/excel";
import { categoryTitle, formatDateTime, formatTime, plural, typeShortLabels, typeTones } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { SearchBox } from "@/components/ui/SearchBox";
import { TableFrame, tdClass, Th } from "@/components/ui/Table";

/**
 * The Grand Finale event desk. Registration: find a team, check in the members who are here (that is their Grand Finale
 * attendance). Food: one coupon per checked-in student for each meal while it is open; bulk coupons for judges and guests.
 */
export function DeskView() {
  const admin = useAdmin();
  const desk = useQuery("desk", () => api.desk());
  const [q, setQ] = useState("");
  const results = useQuery(q.trim() ? `desk-search:${q.trim()}` : null, () => api.deskSearch(q.trim()));
  const [teams, setTeams] = useState<Record<string, DeskTeam>>({});
  const [meal, setMeal] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const data = desk.data;
  const openMeals = useMemo(() => (data?.meals ?? []).filter((m) => m.open), [data]);
  // The meal coupons are given for: the one chosen, or the first open one.
  const activeMeal = openMeals.find((m) => m.key === meal) ?? openMeals[0] ?? null;

  // Refresh the counts now and then, as several desks work at once.
  const reloadDesk = desk.reload;
  useEffect(() => {
    const timer = setInterval(reloadDesk, 30_000);
    return () => clearInterval(timer);
  }, [reloadDesk]);

  const shown = (results.data ?? []).map((t) => teams[t.id] ?? t);
  function updated(team: DeskTeam) {
    setTeams((all) => ({ ...all, [team.id]: team }));
    desk.reload();
  }

  async function exportAll() {
    setExporting(true);
    setExportError(null);
    try {
      const all = await api.deskExport();
      const meals = data?.meals ?? [];
      type Row = { team: DeskTeam; member: DeskMember };
      const rows: Row[] = all.flatMap((team) => team.members.map((member) => ({ team, member })));
      await downloadWorkbook("finale-desk", [
        sheet(
          "Check-in and coupons",
          [
            { header: "Stall", width: 8, value: (r: Row) => r.team.tent ?? "", text: true },
            { header: "Team code", width: 12, value: (r: Row) => r.team.code, text: true },
            { header: "Team", width: 28, value: (r: Row) => r.team.name },
            { header: "Category", width: 9, value: (r: Row) => r.team.category },
            { header: "From", width: 34, value: (r: Row) => (r.team.participantType === "kiet" ? `KIET ${r.team.department ?? ""}`.trim() : r.team.institution) },
            { header: "Student", width: 28, value: (r: Row) => r.member.fullName },
            { header: "Role", width: 8, value: (r: Row) => r.member.role },
            { header: "Roll number", width: 18, value: (r: Row) => r.member.rollNumber, text: true },
            { header: "Checked in", width: 20, value: (r: Row) => (r.member.checkedInAt ? formatDateTime(r.member.checkedInAt) : "") },
            { header: "Checked in by", width: 28, value: (r: Row) => r.member.checkedInBy ?? "" },
            ...meals.map((m) => ({ header: m.label, width: 14, value: (r: Row) => (r.member.coupons[m.key] ? formatTime(r.member.coupons[m.key]) : "") })),
          ],
          rows,
        ),
        sheet(
          "Other coupons",
          [
            { header: "Meal", width: 16, value: (e: Desk["extras"][number]) => meals.find((m) => m.key === e.meal)?.label ?? e.meal },
            { header: "Coupons", width: 10, value: (e: Desk["extras"][number]) => e.quantity },
            { header: "For", width: 32, value: (e: Desk["extras"][number]) => e.recipient },
            { header: "Given", width: 20, value: (e: Desk["extras"][number]) => formatDateTime(e.issuedAt) },
            { header: "Given by", width: 28, value: (e: Desk["extras"][number]) => e.issuedBy },
          ],
          data?.extras ?? [],
        ),
      ]);
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Grand Finale · 30 October"
        title="Event desk"
        description="Registration and food coupons. Find a team by its code, stall, name, or a student's name, roll number or phone; check in the students who are here, then give each one their coupon."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => desk.reload()}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={exportAll} pending={exporting} disabled={!data}>
              {!exporting && <Download aria-hidden="true" className="size-3.5" />}
              Download (Excel)
            </Button>
          </>
        }
      />
      {exportError && <Notice tone="error">{exportError}</Notice>}
      {desk.error && <Notice tone="error">{desk.error}</Notice>}
      {!data && !desk.error && <Loading label="Loading the desk" />}

      {data && (
        <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Teams checked in" value={data.teamsCheckedIn} of={data.teams} />
          <Stat label="Students checked in" value={data.studentsCheckedIn} of={data.students} />
          {data.meals.map((m) => (
            <Stat key={m.key} label={`${m.label} coupons${m.open ? "" : " (closed)"}`} value={m.given + m.extras} of={null} note={m.extras ? `${m.given} students + ${m.extras} others` : `${m.given} students`} />
          ))}
        </section>
      )}

      {data && (
        <section aria-labelledby="meal-title" className="space-y-3">
          <SectionTitle id="meal-title" title="Food coupons for" meta={data.canManage ? "Open a meal when it is served; close it after." : "The organisers open each meal when it is served."} />
          {openMeals.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Meal">
              {openMeals.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={activeMeal?.key === m.key}
                  onClick={() => setMeal(m.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset transition ${activeMeal?.key === m.key ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-900 ring-line hover:bg-surface"}`}
                >
                  <Utensils aria-hidden="true" className="size-4" />
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            <Notice tone="info">No meal is open right now, so no coupons can be given. You can still check teams in.</Notice>
          )}
          {data.canManage && <MealSettings desk={data} onChange={(next) => desk.setData(next)} />}
        </section>
      )}

      <section aria-labelledby="find-title" className="space-y-3">
        <SectionTitle id="find-title" title="Find a team" />
        <SearchBox id="desk-search" label="Find a team" placeholder="IT26-0217, stall 12, team name, student name, roll number or phone" value={q}
          onSearch={(value) => {
            setQ(value);
            setTeams({});
          }}
        />
        {results.error && <Notice tone="error">{results.error}</Notice>}
        {q.trim() && results.loading && !results.data && <Loading label="Searching" />}
        {q.trim() && results.data && shown.length === 0 && (
          <EmptyState title="No Grand Finale team matches">Check the code or spelling. Teams that are not taking part in the Grand Finale are not listed: send them to the help desk.</EmptyState>
        )}
        <div className="space-y-4">
          {shown.map((team) => (
            <TeamCard key={team.id} team={team} meal={activeMeal} canManage={Boolean(data?.canManage)} onUpdated={updated} />
          ))}
        </div>
      </section>

      {data && (
        <section aria-labelledby="extras-title" className="space-y-3">
          <SectionTitle id="extras-title" title="Coupons for judges, volunteers and guests" meta="Given in bulk, with who they were for" />
          <ExtrasForm desk={data} meal={activeMeal} onDone={() => desk.reload()} />
          {data.extras.length > 0 && <ExtrasList desk={data} canManage={data.canManage} onDone={() => desk.reload()} />}
        </section>
      )}
      <p className="text-xs text-muted">Signed in as {admin.email}. Every check-in and coupon is recorded with your email.</p>
    </div>
  );
}

function Stat({ label, value, of, note }: { label: string; value: number; of: number | null; note?: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-line">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-navy-900">
        {value}
        {of !== null && <span className="text-base font-semibold text-muted"> / {of}</span>}
      </p>
      {note && <p className="text-xs text-muted">{note}</p>}
      {of ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (100 * value) / of)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function TeamCard({ team, meal, canManage, onUpdated }: { team: DeskTeam; meal: Meal | null; canManage: boolean; onUpdated: (team: DeskTeam) => void }) {
  const notIn = team.members.filter((m) => !m.checkedInAt && !m.banned).map((m) => m.userId);
  const [selected, setSelected] = useState<string[]>(() => notIn);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<DeskMember | null>(null);
  const [takingBack, setTakingBack] = useState<DeskMember | null>(null);

  const checkedIn = team.members.filter((m) => m.checkedInAt);
  const toGive = meal ? checkedIn.filter((m) => !m.coupons[meal.key]) : [];
  const toggle = (userId: string) => setSelected((s) => (s.includes(userId) ? s.filter((x) => x !== userId) : [...s, userId]));

  async function run(what: string, action: () => Promise<string>) {
    setPending(what);
    setError(null);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  const checkIn = () =>
    run("check-in", async () => {
      const ids = selected.filter((id) => notIn.includes(id));
      const next = await api.deskCheckIn(team.id, ids);
      onUpdated(next);
      setSelected([]);
      return `${plural(ids.length, "student")} checked in.`;
    });

  const giveCoupons = () =>
    run("coupons", async () => {
      if (!meal) return "";
      const result = await api.deskGiveCoupons(team.id, meal.key, toGive.map((m) => m.userId));
      onUpdated(result.team);
      const parts = [`${meal.label} coupon given to ${plural(result.given.length, "student")}`];
      if (result.already.length) parts.push(`already had one: ${result.already.join(", ")}`);
      if (result.notCheckedIn.length) parts.push(`not checked in: ${result.notCheckedIn.join(", ")}`);
      return `${parts.join("; ")}.`;
    });

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <header className="flex flex-wrap items-start gap-4 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-navy-950 text-white">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Stall</span>
          <span className="font-display text-xl font-bold">{team.tent ?? "—"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold text-navy-900">{team.name}</h3>
          <p className="text-xs text-muted">
            {team.code} · Category {team.category}: {categoryTitle(team.category)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-navy-800">
            <Pill tone={team.route === "department" ? "orange" : typeTones[team.participantType]}>
              {team.route === "department" ? `Finalist · ${team.department}` : typeShortLabels[team.participantType]}
            </Pill>
            {team.participantType !== "kiet" && <span>{team.institution}</span>}
          </p>
        </div>
        <p className="text-sm font-semibold text-navy-900">
          {checkedIn.length} / {team.members.length} checked in
        </p>
      </header>

      <TableFrame label={`Members of ${team.name}`} minWidth="min-w-[640px]">
        <thead>
          <tr>
            <Th className="w-10">
              <span className="sr-only">Select</span>
            </Th>
            <Th>Student</Th>
            <Th>Check-in</Th>
            <Th>{meal ? `${meal.label} coupon` : "Coupon"}</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {team.members.map((m) => {
            const given = meal ? m.coupons[meal.key] : undefined;
            return (
              <tr key={m.userId}>
                <td className={tdClass}>
                  {!m.checkedInAt && !m.banned && (
                    <input type="checkbox" className="size-4 accent-navy-900" checked={selected.includes(m.userId)} onChange={() => toggle(m.userId)} aria-label={`Select ${m.fullName}`} />
                  )}
                </td>
                <td className={tdClass}>
                  <span className="font-semibold text-navy-900">{m.fullName}</span>
                  {m.role === "leader" && <span className="ml-1.5 text-xs font-semibold text-accent-600">Leader</span>}
                  <span className="block text-xs text-muted">
                    {[m.rollNumber, m.department, m.course, m.phone].filter(Boolean).join(" · ")}
                  </span>
                  {m.banned && <span className="block text-xs font-semibold text-red-700">Suspended by the organisers: do not check in</span>}
                </td>
                <td className={tdClass}>
                  {m.checkedInAt ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                      <CircleCheck aria-hidden="true" className="size-4" />
                      {formatTime(m.checkedInAt)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted">Not yet</span>
                  )}
                </td>
                <td className={tdClass}>
                  {!meal ? (
                    <span className="text-muted">—</span>
                  ) : given ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                      <Ticket aria-hidden="true" className="size-4" />
                      Given {formatTime(given)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted">{m.checkedInAt ? "Not given" : "Check in first"}</span>
                  )}
                </td>
                <td className={`${tdClass} whitespace-nowrap text-right`}>
                  {m.checkedInAt && (
                    <Button variant="ghost" size="sm" onClick={() => setCheckingOut(m)}>
                      Undo check-in<span className="sr-only"> for {m.fullName}</span>
                    </Button>
                  )}
                  {canManage && given && meal && (
                    <Button variant="ghost" size="sm" className="text-red-700" onClick={() => setTakingBack(m)}>
                      Take coupon back<span className="sr-only"> from {m.fullName}</span>
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableFrame>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
        <Button onClick={checkIn} pending={pending === "check-in"} disabled={pending !== null || selected.filter((id) => notIn.includes(id)).length === 0}>
          {pending !== "check-in" && <UserCheck aria-hidden="true" className="size-4" />}
          Check in {selected.filter((id) => notIn.includes(id)).length || ""} selected
        </Button>
        {meal && (
          <Button variant="secondary" onClick={giveCoupons} pending={pending === "coupons"} disabled={pending !== null || toGive.length === 0}>
            {pending !== "coupons" && <Ticket aria-hidden="true" className="size-4" />}
            Give {meal.label} coupon{toGive.length === 1 ? "" : "s"} ({toGive.length})
          </Button>
        )}
      </footer>
      {(error || message) && <div className="px-4 pb-3 sm:px-5">{error ? <Notice tone="error">{error}</Notice> : <Notice tone="success">{message}</Notice>}</div>}

      {checkingOut && (
        <ConfirmDialog
          title={`Undo ${checkingOut.fullName}'s check-in?`}
          description="Use this when the wrong student was checked in. Coupons already given stay given."
          confirmLabel="Undo check-in"
          reasonLabel="Why?"
          onClose={() => setCheckingOut(null)}
          onConfirm={async (reason) => {
            onUpdated(await api.deskCheckOut(team.id, checkingOut.userId, reason));
            setCheckingOut(null);
          }}
        />
      )}
      {takingBack && meal && (
        <ConfirmDialog
          title={`Take back ${takingBack.fullName}'s ${meal.label} coupon?`}
          description="The student can then be given the coupon again."
          confirmLabel="Take coupon back"
          tone="danger"
          reasonLabel="Why?"
          onClose={() => setTakingBack(null)}
          onConfirm={async (reason) => {
            onUpdated(await api.deskTakeBackCoupon(team.id, meal.key, takingBack.userId, reason));
            setTakingBack(null);
          }}
        />
      )}
    </article>
  );
}

function MealSettings({ desk, onChange }: { desk: Desk; onChange: (desk: Desk) => void }) {
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<Desk>) {
    setPending(key);
    setError(null);
    try {
      onChange(await action());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (label.trim().length < 2) return setError("Name the meal, e.g. Lunch.");
    run("add", async () => {
      const next = await api.deskAddMeal(label.trim());
      setLabel("");
      return next;
    });
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      {desk.meals.length > 0 && (
        <ul className="divide-y divide-line">
          {desk.meals.map((m) => (
            <li key={m.key} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 flex-1 text-sm font-semibold text-navy-900">
                {m.label}{" "}
                <Pill tone={m.open ? "green" : "slate"}>{m.open ? "Open: coupons being given" : "Closed"}</Pill>
                <span className="ml-2 text-xs font-normal text-muted">{plural(m.given + m.extras, "coupon")} given</span>
              </span>
              <Button size="sm" variant={m.open ? "secondary" : "primary"} pending={pending === m.key} onClick={() => run(m.key, () => api.deskUpdateMeal(m.key, { open: !m.open }))}>
                {pending !== m.key && (m.open ? <Lock aria-hidden="true" className="size-3.5" /> : <LockOpen aria-hidden="true" className="size-3.5" />)}
                {m.open ? "Close" : "Open"}
              </Button>
              {m.given + m.extras === 0 && (
                <Button size="sm" variant="ghost" className="text-red-700" pending={pending === `delete:${m.key}`} onClick={() => run(`delete:${m.key}`, () => api.deskDeleteMeal(m.key))}>
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  <span className="sr-only">Delete {m.label}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} noValidate className="flex flex-wrap items-end gap-2">
        <Field label="Add a meal" htmlFor="meal-label" className="min-w-48 flex-1">
          <Input id="meal-label" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="Lunch, Evening snacks…" />
        </Field>
        <Button type="submit" variant="secondary" pending={pending === "add"}>
          {pending !== "add" && <Plus aria-hidden="true" className="size-4" />}
          Add meal
        </Button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function ExtrasForm({ desk, meal, onDone }: { desk: Desk; meal: Meal | null; onDone: () => void }) {
  const [quantity, setQuantity] = useState("");
  const [recipient, setRecipient] = useState("");
  const [mealKey, setMealKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const openMeals = desk.meals.filter((m) => m.open);
  const chosen = openMeals.find((m) => m.key === mealKey) ?? meal;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const count = Number(quantity);
    if (!chosen) return setError("Open a meal first.");
    if (!Number.isInteger(count) || count < 1 || count > 500) return setError("Enter how many coupons, from 1 to 500.");
    if (recipient.trim().length < 2) return setError("Say who they are for, e.g. Judges corner or Volunteers.");
    setPending(true);
    setError(null);
    try {
      await api.deskGiveExtras(chosen.key, count, recipient.trim());
      setMessage(`${count} ${chosen.label} coupons recorded for ${recipient.trim()}.`);
      setQuantity("");
      setRecipient("");
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,2fr)_auto] sm:items-end">
        <Field label="Meal" htmlFor="extra-meal">
          <Select id="extra-meal" value={chosen?.key ?? ""} onChange={(e) => setMealKey(e.target.value)} disabled={openMeals.length === 0}>
            {openMeals.length === 0 && <option value="">No meal open</option>}
            {openMeals.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Coupons" htmlFor="extra-quantity">
          <Input id="extra-quantity" type="number" min={1} max={500} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="For" htmlFor="extra-recipient">
          <Input id="extra-recipient" value={recipient} maxLength={120} onChange={(e) => setRecipient(e.target.value)} placeholder="Judges corner, volunteers, a startup's team…" />
        </Field>
        <Button type="submit" pending={pending} disabled={openMeals.length === 0}>
          {!pending && <Ticket aria-hidden="true" className="size-4" />}
          Record
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {message && !error && <Notice tone="success">{message}</Notice>}
    </form>
  );
}

function ExtrasList({ desk, canManage, onDone }: { desk: Desk; canManage: boolean; onDone: () => void }) {
  const [removing, setRemoving] = useState<Desk["extras"][number] | null>(null);
  const label = (key: string) => desk.meals.find((m) => m.key === key)?.label ?? key;
  return (
    <>
      <TableFrame label="Coupons given to others" minWidth="min-w-[560px]">
        <thead>
          <tr>
            <Th>For</Th>
            <Th>Meal</Th>
            <Th>Coupons</Th>
            <Th>Given</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {desk.extras.map((e) => (
            <tr key={e.id}>
              <td className={`${tdClass} font-semibold text-navy-900`}>{e.recipient}</td>
              <td className={tdClass}>{label(e.meal)}</td>
              <td className={`${tdClass} tabular-nums`}>{e.quantity}</td>
              <td className={`${tdClass} text-xs text-muted`}>
                {formatDateTime(e.issuedAt)}
                <span className="block break-all">{e.issuedBy}</span>
              </td>
              <td className={`${tdClass} text-right`}>
                {canManage && (
                  <Button variant="ghost" size="sm" className="text-red-700" onClick={() => setRemoving(e)}>
                    Take back<span className="sr-only"> {e.quantity} coupons for {e.recipient}</span>
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableFrame>
      {removing && (
        <ConfirmDialog
          title="Take these coupons back?"
          description={`${removing.quantity} ${label(removing.meal)} coupons for ${removing.recipient} will no longer be counted.`}
          confirmLabel="Take back"
          tone="danger"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await api.deskRemoveExtra(removing.id);
            setRemoving(null);
            onDone();
          }}
        />
      )}
    </>
  );
}
