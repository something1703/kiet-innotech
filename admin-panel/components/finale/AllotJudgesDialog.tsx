"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Finale, FinaleAllot, FinaleSection } from "@/lib/admin-types";
import { plural } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { TableFrame, tdClass, Th } from "@/components/ui/Table";

const EMAIL = /[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/;
const ORDER: FinaleSection[] = ["category", "school", "college", "coe", "club", "startup"];
// Start-ups, CoE KIET and technical clubs are judged by their own judges, so they are left out unless ticked.
const DEFAULT: FinaleSection[] = ["category", "school", "college"];

/** Each line's email, in order: a pasted spreadsheet row ("1, Mr. Name, email") or just the email. */
export function judgeEmails(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.match(EMAIL)?.[0].toLowerCase())
    .filter((email): email is string => Boolean(email));
}

/**
 * Super admins: one panel per judge over consecutive octonorms, in the order the judges are listed: the first judge gets
 * the lowest numbers ("Panel 1 · Octonorms 3-12"), the next the following ones, and so on, as even as possible. A plan
 * is shown first; nothing is made until "Make the panels".
 */
export function AllotJudgesDialog({ finale, onClose, onDone }: { finale: Finale; onClose: () => void; onDone: (message: string) => void }) {
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<FinaleSection[]>(DEFAULT);
  const [plan, setPlan] = useState<FinaleAllot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emails = judgeEmails(text);

  function toggle(section: FinaleSection, on: boolean) {
    setPlan(null);
    setChosen((current) => (on ? ORDER.filter((s) => s === section || current.includes(s)) : current.filter((s) => s !== section)));
  }

  async function run(apply: boolean) {
    setPending(true);
    setError(null);
    try {
      const result = await api.allotFinale(emails, chosen, apply);
      if (apply) return onDone(`${plural(result.panels.length, "panel")} made, one judge each, octonorms ${result.panels[0].first} to ${result.panels[result.panels.length - 1].last}.`);
      setPlan(result);
    } catch (err) {
      setError(errorMessage(err));
      setPlan(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      title="Allot judges by octonorm"
      description="One panel per judge. The teams are taken in octonorm order and shared out evenly: the first judge in the list gets the lowest numbers, the next judge the following ones, and so on."
      onClose={onClose}
      busy={pending}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          {plan ? (
            <Button onClick={() => run(true)} pending={pending}>
              Make the {plural(plan.panels.length, "panel")}
            </Button>
          ) : (
            <Button onClick={() => run(false)} pending={pending} disabled={emails.length === 0 || chosen.length === 0}>
              Show the plan
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label={`Judges, in order${emails.length ? ` (${emails.length})` : ""}`}
          htmlFor="allot-judges"
          hint="One per line: paste the rows of the judges' list (S.No, name, email) or just the emails. They must be appointed already (Judges and logins tab)."
        >
          <Textarea
            id="allot-judges"
            rows={7}
            value={text}
            onChange={(e) => (setText(e.target.value), setPlan(null))}
            placeholder={"1  Mr. Arunesh Mishra  cool.arunesh@gmail.com\n2  Dr Vineet Kumar  vineet.kumar@adnolgy.com"}
          />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold text-navy-900">Sections to share out</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {ORDER.map((s) => (
              <label key={s} className="inline-flex items-center gap-2 text-sm text-navy-800">
                <Checkbox label={finale.sections[s]} checked={chosen.includes(s)} onChange={(on) => toggle(s, on)} />
                {finale.sections[s]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Start-ups, Centres of Excellence and technical clubs have their own judges, so they are left out unless you tick them.</p>
        </fieldset>
        {error && <Notice tone="error">{error}</Notice>}
        {plan && (
          <>
            {plan.noOctonorm.length > 0 && (
              <Notice tone="warning" title={`${plural(plan.noOctonorm.length, "team")} without an octonorm left out`}>
                {plan.noOctonorm.join(", ")}. Give them an octonorm on the Teams &amp; octonorms tab first, or add them to a panel by hand later.
              </Notice>
            )}
            {plan.onAPanel.length > 0 && <Notice tone="info">{plural(plan.onAPanel.length, "team")} already on a panel stay where they are.</Notice>}
            <TableFrame label="Planned panels" minWidth="min-w-[560px]">
              <thead>
                <tr>
                  <Th>Panel</Th>
                  <Th>Judge</Th>
                  <Th className="text-right">Teams</Th>
                </tr>
              </thead>
              <tbody>
                {plan.panels.map((p) => (
                  <tr key={p.name}>
                    <td className={`${tdClass} font-semibold text-navy-900`}>{p.name}</td>
                    <td className={tdClass}>
                      {p.jurorName}
                      <span className="block break-all text-xs text-muted">{p.jurorEmail}</span>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{p.teams}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            <p className="text-xs text-muted">Nothing is saved yet. Check the plan, then press &ldquo;Make the panels&rdquo;. Each panel can still be changed by hand afterwards.</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
