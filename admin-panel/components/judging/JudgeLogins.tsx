"use client";

import { useState } from "react";
import { Check, Copy, Download, Upload } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { JudgeImportItem, JudgeImportRow } from "@/lib/admin-types";
import { downloadWorkbook, sheet } from "@/lib/excel";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { TableFrame, tdClass, Th } from "@/components/ui/Table";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Login = { name: string; email: string; password: string };

/** The admin panel's own address, which judges open to sign in. */
const signInUrl = () => (typeof window === "undefined" ? "" : `${window.location.origin}/login`);

export function downloadLogins(logins: Login[]) {
  return downloadWorkbook("judge-logins", [
    sheet(
      "Judge logins",
      [
        { header: "Name", width: 32, value: (l: Login) => l.name },
        { header: "Email (login)", width: 38, value: (l: Login) => l.email, text: true },
        { header: "Password", width: 18, value: (l: Login) => l.password, text: true },
        { header: "Sign in at", width: 44, value: () => `${signInUrl()} → Grand Finale judges`, text: true },
      ],
      logins,
    ),
  ]);
}

/**
 * One judge per line, as pasted from a spreadsheet or typed: the email is found wherever it is, the name is the first
 * other cell that is not a serial number, then the organisation and the phone. Lines without an email are reported.
 */
export function parseJudges(text: string): { judges: JudgeImportItem[]; skipped: string[] } {
  const judges: JudgeImportItem[] = [];
  const skipped: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split(line.includes("\t") ? "\t" : ",").map((c) => c.trim()).filter(Boolean);
    const email = cells.find((c) => EMAIL.test(c));
    const others = cells.filter((c) => c !== email && !/^\d{1,3}\.?$/.test(c));
    const name = others.find((c) => !/^\+?[\d\s-]{10,}$/.test(c));
    if (!email || !name) {
      // A header row ("S.No, Name, Email") is not worth reporting.
      if (!/email/i.test(line)) skipped.push(line.trim());
      continue;
    }
    const phone = others.find((c) => /^\+?[\d\s-]{10,}$/.test(c)) ?? "";
    const organisation = others.find((c) => c !== name && c !== phone) ?? "";
    judges.push({ name, email: email.toLowerCase(), organisation, phone });
  }
  return { judges, skipped };
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined)}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-navy-800 ring-1 ring-inset ring-line hover:bg-surface"
    >
      {copied ? <Check aria-hidden="true" className="size-3.5 text-emerald-600" /> : <Copy aria-hidden="true" className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
      <span className="sr-only"> {label}</span>
    </button>
  );
}

/** A judge's new password, shown once with what to tell them. */
export function PasswordDialog({ login, onClose }: { login: Login; onClose: () => void }) {
  return (
    <Dialog
      title={`Sign-in for ${login.name}`}
      description="Shown only now: the panel keeps just a scrambled copy. Give it to the judge, or download it."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={() => downloadLogins([login])}>
            <Download aria-hidden="true" className="size-4" />
            Download
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold text-muted">Email</dt>
          <dd className="break-all font-semibold text-navy-900">{login.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">Password</dt>
          <dd className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-navy-900">{login.password}</span>
            <CopyButton text={login.password} label="password" />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">Where</dt>
          <dd className="text-navy-800">{signInUrl()}, then &ldquo;Grand Finale judges&rdquo;</dd>
        </div>
      </dl>
    </Dialog>
  );
}

const STATUS: Record<JudgeImportRow["status"], string> = {
  created: "Appointed",
  password_added: "Password added",
  exists: "Already had a password (unchanged)",
};

/** Super admins: appoint outside judges in one go from a pasted list, each with a password, and download the logins. */
export function ImportJudges({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JudgeImportRow[] | null>(null);
  const parsed = parseJudges(text);

  async function submit() {
    if (parsed.judges.length === 0) return setError("Paste at least one line with a name and an email.");
    setPending(true);
    setError(null);
    try {
      setResult(await api.importJurors(parsed.judges));
      setText("");
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const logins = (result ?? []).filter((r): r is JudgeImportRow & { password: string } => r.password !== null);

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
      <Field
        label="Outside judges, one per line"
        htmlFor="judge-import"
        hint="Paste the rows from the judges' spreadsheet (S.No, Name, Email), or type “Name, email, organisation, phone”. Each judge gets a password made from their email, e.g. Arunesh@48217."
      >
        <Textarea id="judge-import" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Mr. Arunesh Mishra, cool.arunesh@gmail.com\nDr Vineet Kumar, vineet.kumar@adnolgy.com, Adnolgy"} />
      </Field>
      {text.trim() && (
        <p className="text-xs text-muted">
          {parsed.judges.length} judge(s) found.
          {parsed.skipped.length > 0 && <span className="font-semibold text-red-700"> {parsed.skipped.length} line(s) without a name and an email are left out: {parsed.skipped.slice(0, 3).join(" | ")}</span>}
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex justify-end">
        <Button onClick={submit} pending={pending} disabled={parsed.judges.length === 0}>
          {!pending && <Upload aria-hidden="true" className="size-4" />}
          Appoint {parsed.judges.length || ""} judge(s) with passwords
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          <Notice tone="success" title="Judges appointed">
            Passwords are shown only now. Download them and share each one with its judge.
          </Notice>
          {logins.length > 0 && (
            <Button variant="secondary" onClick={() => downloadLogins(logins)}>
              <Download aria-hidden="true" className="size-4" />
              Download logins (Excel)
            </Button>
          )}
          <TableFrame label="New judge logins" minWidth="min-w-[640px]">
            <thead>
              <tr>
                <Th>Judge</Th>
                <Th>Password</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {result.map((r) => (
                <tr key={r.email}>
                  <td className={tdClass}>
                    <span className="font-semibold text-navy-900">{r.name}</span>
                    <span className="block break-all text-xs text-muted">{r.email}</span>
                  </td>
                  <td className={tdClass}>
                    {r.password ? (
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-bold text-navy-900">{r.password}</span>
                        <CopyButton text={r.password} label={`password of ${r.name}`} />
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-xs`}>{STATUS[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        </div>
      )}
    </div>
  );
}
