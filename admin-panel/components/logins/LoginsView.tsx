"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, Eye, EyeOff, FileSpreadsheet, FileText, KeyRound, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { Credential, CredentialRef } from "@/lib/admin-types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { downloadWorkbook, sheet } from "@/lib/excel";
import { formatDateTime, plural } from "@/lib/format";
import { downloadLoginsPdf } from "@/lib/logins-pdf";
import { useQuery } from "@/lib/use-query";
import { CopyButton, PASSWORD_TAB, signInUrl } from "@/components/judging/JudgeLogins";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { TableFrame, tdClass, Th } from "@/components/ui/Table";

const keyOf = (c: CredentialRef) => `${c.kind}:${c.email}`;
const kindLabel = { judge: "Judge", desk: "Registration desk" } as const;
const columns = [
  { header: "Name", width: 30, value: (c: Credential) => c.name },
  { header: "Role", width: 18, value: (c: Credential) => kindLabel[c.kind] },
  { header: "Organisation", width: 30, value: (c: Credential) => c.detail },
  { header: "Username (email)", width: 38, value: (c: Credential) => c.email, text: true },
  { header: "Password", width: 18, value: (c: Credential) => c.password ?? "", text: true },
  { header: "Grand Finale panel", width: 30, value: (c: Credential) => c.panels.join(", ") },
  { header: "Sign in at", width: 44, value: () => `${signInUrl()} → ${PASSWORD_TAB}`, text: true },
];

/**
 * Super admins: every outside judge and registration desk volunteer login they made, with its username and password, to
 * look up, copy or download at any time, and to give new passwords to one or many at once.
 */
export function LoginsView() {
  const logins = useQuery("credentials", () => api.credentials());
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState<"" | Credential["kind"]>("");
  const [shown, setShown] = useState<"" | "yes" | "no">("");
  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState<Credential[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const all = useMemo(() => logins.data ?? [], [logins.data]);
  const q = filter.trim().toLowerCase();
  const rows = all.filter(
    (c) =>
      (!kind || c.kind === kind) &&
      (shown === "" || (shown === "yes") === (c.password !== null)) &&
      (!q || [c.name, c.email, c.detail, c.phone].some((v) => v.toLowerCase().includes(q))),
  );
  const chosen = rows.filter((c) => selected.has(keyOf(c)));
  // Downloads, copies and new passwords act on the ticked rows, or on everything in the list when none is ticked.
  const targets = chosen.length ? chosen : rows;
  const withPassword = targets.filter((c) => c.password !== null);
  const counts = {
    judges: all.filter((c) => c.kind === "judge").length,
    desk: all.filter((c) => c.kind === "desk").length,
    shown: all.filter((c) => c.password !== null).length,
    hidden: all.filter((c) => c.hasPassword && c.password === null).length,
    none: all.filter((c) => !c.hasPassword).length,
  };

  function toggle(c: Credential, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(keyOf(c));
      else next.delete(keyOf(c));
      return next;
    });
  }

  function reveal(c: Credential) {
    setRevealed((current) => {
      const next = new Set(current);
      if (!next.delete(keyOf(c))) next.add(keyOf(c));
      return next;
    });
  }

  function copyAll() {
    const text = withPassword.map((c) => `${c.name} (${kindLabel[c.kind]})\nUsername: ${c.email}\nPassword: ${c.password}`).join("\n\n");
    navigator.clipboard?.writeText(`Sign in at ${signInUrl()} → ${PASSWORD_TAB}\n\n${text}`).then(
      () => {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2500);
      },
      () => undefined,
    );
  }

  function csv() {
    const header = columns.map((c) => c.header);
    downloadCsv(`innotech26-logins-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(header, withPassword.map((c) => columns.map((col) => col.value(c)))));
  }

  async function reset() {
    if (!resetting) return;
    const done = await api.resetCredentials(resetting.map((c) => ({ email: c.email, kind: c.kind })));
    const fresh = new Map(done.credentials.map((c) => [keyOf(c), c]));
    logins.setData(all.map((c) => fresh.get(keyOf(c)) ?? c));
    // The new passwords are the ones about to be handed out: shown and ticked, ready to download. The "Not shown" filter
    // would hide them now, so it is cleared.
    setShown("");
    setRevealed((current) => new Set([...current, ...fresh.keys()]));
    setSelected(new Set(fresh.keys()));
    setMessage(
      `${plural(done.credentials.length, "new password")} made; the old ones no longer work. They are ticked below, ready to download.` +
        (done.skipped.length ? ` Not found: ${done.skipped.join(", ")}.` : ""),
    );
    setResetting(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access"
        title="Logins & passwords"
        description="Every outside judge and registration desk volunteer you made, with the username and password to give them. Look them up, copy or download them at any time."
        actions={
          <Button variant="secondary" onClick={logins.reload} pending={logins.loading}>
            {!logins.loading && <RefreshCw aria-hidden="true" className="size-4" />}
            Refresh
          </Button>
        }
      />
      {logins.error && <Notice tone="error">{logins.error}</Notice>}
      {!logins.data && !logins.error && <Loading label="Loading the logins" />}
      {logins.data && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Judges", counts.judges],
                ["Registration desk", counts.desk],
                ["Passwords you can see", counts.shown],
                ["Need a new password", counts.hidden + counts.none],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
                <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>
          {counts.hidden + counts.none > 0 && (
            <Notice tone="info" title="Some logins have no password to show">
              {counts.hidden > 0 && `${plural(counts.hidden, "login")} got a password before passwords could be looked up: it still works, but only a scrambled copy was kept. `}
              {counts.none > 0 && `${plural(counts.none, "login")} ${counts.none === 1 ? "has" : "have"} no password yet. `}
              Pick &ldquo;Not shown&rdquo; in the Password filter and press &ldquo;New passwords&rdquo; to give them one you can see.
            </Notice>
          )}
          {message && <Notice tone="success">{message}</Notice>}

          <section className="space-y-3" aria-label="Logins">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Search" htmlFor="login-search" className="min-w-52 flex-1">
                <Input id="login-search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name, email, organisation, phone" />
              </Field>
              <Field label="Role" htmlFor="login-kind" className="w-44">
                <Select id="login-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                  <option value="">All</option>
                  <option value="judge">Judges</option>
                  <option value="desk">Registration desk</option>
                </Select>
              </Field>
              <Field label="Password" htmlFor="login-shown" className="w-56">
                <Select id="login-shown" value={shown} onChange={(e) => setShown(e.target.value as typeof shown)}>
                  <option value="">All</option>
                  <option value="yes">Can be shown</option>
                  <option value="no">Not shown (needs a new one)</option>
                </Select>
              </Field>
              <label className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-navy-800">
                <Checkbox label="Show every password" checked={showAll} onChange={setShowAll} />
                Show every password
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line">
              <p className="mr-auto text-sm font-semibold text-navy-800">
                {chosen.length ? `${chosen.length} ticked` : `${plural(rows.length, "login")} in the list`}
                <span className="font-normal text-muted"> · the buttons act on {chosen.length ? "the ticked ones" : "all of them"}</span>
              </p>
              <Button size="sm" variant="secondary" disabled={withPassword.length === 0} onClick={() => downloadLoginsPdf(withPassword, `${signInUrl()}, tab "${PASSWORD_TAB}"`)}>
                <FileText aria-hidden="true" className="size-4" />
                PDF
              </Button>
              <Button size="sm" variant="secondary" disabled={withPassword.length === 0} onClick={() => downloadWorkbook("logins", [sheet("Logins", columns, withPassword)])}>
                <FileSpreadsheet aria-hidden="true" className="size-4" />
                Excel
              </Button>
              <Button size="sm" variant="secondary" disabled={withPassword.length === 0} onClick={csv}>
                <Download aria-hidden="true" className="size-4" />
                CSV
              </Button>
              <Button size="sm" variant="secondary" disabled={withPassword.length === 0} onClick={copyAll}>
                {copiedAll ? <Check aria-hidden="true" className="size-4 text-emerald-600" /> : <Copy aria-hidden="true" className="size-4" />}
                {copiedAll ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" disabled={targets.length === 0} onClick={() => setResetting(targets)}>
                <KeyRound aria-hidden="true" className="size-4" />
                New passwords ({targets.length})
              </Button>
              {chosen.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear ticks
                </Button>
              )}
            </div>
            {withPassword.length > 0 && targets.length > withPassword.length && (
              <p className="text-xs text-muted">
                {plural(targets.length - withPassword.length, "login")} without a password to show {targets.length - withPassword.length === 1 ? "is" : "are"} left out of the
                downloads and the copy.
              </p>
            )}

            {rows.length === 0 ? (
              <EmptyState title="No logins match">Change the search or the filters. Judges are added on the Judging page, desk volunteers on the Admins page.</EmptyState>
            ) : (
              <TableFrame label="Logins" minWidth="min-w-[880px]">
                <thead>
                  <tr>
                    <Th className="w-10">
                      <Checkbox
                        label="Tick every login in the list"
                        checked={chosen.length === rows.length}
                        indeterminate={chosen.length > 0}
                        onChange={(on) => setSelected(on ? new Set(rows.map(keyOf)) : new Set())}
                      />
                    </Th>
                    <Th>Name</Th>
                    <Th>Username (email)</Th>
                    <Th>Password</Th>
                    <Th>Made</Th>
                    <Th className="w-24">
                      <span className="sr-only">New password</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const visible = showAll || revealed.has(keyOf(c));
                    return (
                      <tr key={keyOf(c)} className={selected.has(keyOf(c)) ? "bg-brand-50/60" : ""}>
                        <td className={tdClass}>
                          <Checkbox label={`Tick ${c.name}`} checked={selected.has(keyOf(c))} onChange={(on) => toggle(c, on)} />
                        </td>
                        <td className={tdClass}>
                          <span className="font-semibold text-navy-900">{c.name}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <Pill tone={c.kind === "judge" ? "navy" : "cyan"}>{kindLabel[c.kind]}</Pill>
                            {c.kind === "judge" && c.detail && <span>{c.detail}</span>}
                          </span>
                          {c.panels.length > 0 && <span className="mt-1 block text-xs font-semibold text-accent-600">{c.panels.join(", ")}</span>}
                        </td>
                        <td className={tdClass}>
                          <span className="flex items-center gap-2">
                            <span className="break-all font-mono text-xs text-navy-900">{c.email}</span>
                            <CopyButton text={c.email} label={`username of ${c.name}`} />
                          </span>
                        </td>
                        <td className={tdClass}>
                          {c.password !== null ? (
                            <span className="flex items-center gap-2">
                              <span className="min-w-28 font-mono text-base font-bold text-navy-900">{visible ? c.password : "••••••••"}</span>
                              {!showAll && (
                                <button
                                  type="button"
                                  onClick={() => reveal(c)}
                                  className="rounded-full p-1.5 text-navy-800 ring-1 ring-inset ring-line hover:bg-surface"
                                >
                                  {visible ? <EyeOff aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
                                  <span className="sr-only">
                                    {visible ? "Hide" : "Show"} the password of {c.name}
                                  </span>
                                </button>
                              )}
                              <CopyButton text={c.password} label={`password of ${c.name}`} />
                            </span>
                          ) : c.hasPassword ? (
                            <Pill tone="orange">Made earlier: not shown</Pill>
                          ) : (
                            <Pill tone="slate">No password</Pill>
                          )}
                        </td>
                        <td className={`${tdClass} text-xs text-muted`}>
                          {c.passwordSetAt ? formatDateTime(c.passwordSetAt) : "—"}
                          {c.passwordSetBy && <span className="block break-all">{c.passwordSetBy}</span>}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <Button size="sm" variant="secondary" onClick={() => setResetting([c])}>
                            <KeyRound aria-hidden="true" className="size-3.5" />
                            New
                            <span className="sr-only"> password for {c.name}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableFrame>
            )}
          </section>
        </>
      )}
      {resetting && (
        <ConfirmDialog
          title={resetting.length === 1 ? `New password for ${resetting[0].name}` : `New passwords for ${resetting.length} logins`}
          description={`The current ${resetting.length === 1 ? "password stops" : "passwords stop"} working at once. The new ${resetting.length === 1 ? "one is" : "ones are"} shown here straight away, ready to copy or download.`}
          confirmLabel="Make new passwords"
          onConfirm={reset}
          onClose={() => setResetting(null)}
        />
      )}
    </div>
  );
}
