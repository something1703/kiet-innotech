"use client";

import { useState } from "react";
import { Award, CheckCircle2, Rocket, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import type { ReleaseReadiness } from "@/lib/admin-types";
import { departmentLabel } from "@/lib/content";
import { formatDateTime, plural } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { Pill } from "@/components/ui/Pill";

const templateNames: Record<string, string> = {
  dept_winner: "Winner certificate",
  dept_participation: "Participation certificate",
  dept_judge: "Judge certificate",
};

/**
 * The super admin's one button for the department round: names the winners of every problem statement, shows them to students
 * and opens the certificates. Before it is pressed students and judges see nothing; after it, "Withdraw" hides it all again.
 */
export function ReleasePanel({ onChanged }: { onChanged: () => void }) {
  const status = useQuery("release-readiness", () => api.releaseReadiness());
  const [releasing, setReleasing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [anyway, setAnyway] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const data = status.data;

  if (status.error) return <Notice tone="error">{status.error}</Notice>;
  if (!data) return null;

  async function afterChange(message: string) {
    setDone(message);
    setReleasing(false);
    setWithdrawing(false);
    setAnyway(false);
    status.reload();
    onChanged();
  }

  return (
    <section aria-labelledby="release-title" className={`rounded-3xl p-5 ring-1 sm:p-6 ${data.released ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${data.released ? "bg-emerald-600 text-white" : "bg-accent-50 text-accent-600"}`}>
            {data.released ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <Rocket className="size-5" aria-hidden="true" />}
          </span>
          <div>
            <h2 id="release-title" className="font-display text-lg font-bold text-navy-900">
              {data.released ? "Department results are released" : "Release the department results"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              {data.released
                ? `Released by ${data.releasedBy}${data.releasedAt ? ` on ${formatDateTime(data.releasedAt)}` : ""}. Students see their result and download their certificate; judges download theirs.`
                : "Names the winners of every problem statement, shows them to students with a celebration and opens the certificates: a winner certificate for the winning teams, a participation certificate for everyone else marked present, a judge certificate for judges who judged. Until you press it, nobody sees anything."}
            </p>
          </div>
        </div>
        {data.released ? (
          <Button variant="secondary" onClick={() => setWithdrawing(true)}>
            Withdraw
          </Button>
        ) : (
          <Button onClick={() => setReleasing(true)}>
            <Award className="size-4" aria-hidden="true" />
            Review and release
          </Button>
        )}
      </div>
      {done && <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">{done}</p>}

      {releasing && (
        <ConfirmDialog
          title="Release the department results?"
          description="Students and judges will see this straight away. You can withdraw it afterwards."
          confirmLabel="Release results"
          typeToConfirm="RELEASE"
          onClose={() => setReleasing(false)}
          onConfirm={async () => {
            if (data.openRooms > 0 && !anyway) throw new Error("Tick the box to release while rooms are still open, or wait until their time is over.");
            const result = await api.releaseResults(anyway);
            await afterChange(`Released: ${plural(result.winners, "winning team")}, ${plural(result.groupsWithoutWinner, "problem statement")} without a winner.`);
          }}
        >
          <Preview data={data} anyway={anyway} setAnyway={setAnyway} />
        </ConfirmDialog>
      )}
      {withdrawing && (
        <ConfirmDialog
          title="Withdraw the department results?"
          description="Students stop seeing results and certificates, and judges lose their certificate. Winners the release named are taken back; winners declared by hand stay declared."
          confirmLabel="Withdraw"
          tone="danger"
          reasonLabel="Why are you withdrawing them?"
          onClose={() => setWithdrawing(false)}
          onConfirm={async (reason) => {
            await api.withdrawRelease(reason);
            await afterChange("Withdrawn. Students and judges no longer see the results.");
          }}
        />
      )}
    </section>
  );
}

function Preview({ data, anyway, setAnyway }: { data: ReleaseReadiness; anyway: boolean; setAnyway: (value: boolean) => void }) {
  const missing = Object.entries(data.templates).filter(([, published]) => !published);
  const noWinner = data.groups.filter((g) => g.winners.length === 0);
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["Winning teams", data.winnerTeams],
          ["Winner certificates", data.winnerStudents],
          ["Participation certificates", data.participationStudents],
          ["Judge certificates", data.judges],
          ["Students not marked present", data.notMarked + data.absent],
          ["Problem statements without a winner", data.groupsWithoutWinner],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-display text-xl font-bold tabular-nums text-navy-900">{Number(value).toLocaleString("en-IN")}</dd>
          </div>
        ))}
      </dl>

      {data.openRooms > 0 && (
        <Notice tone="warning" title={`${plural(data.openRooms, "room")} still open for judging`}>
          Judges can still change marks there, so a winner could change after this. Wait for their time to end, or release anyway.
          <span className="mt-2 block">
            <Checkbox label="Release anyway, with rooms still open" checked={anyway} onChange={setAnyway} />
          </span>
        </Notice>
      )}
      {missing.length > 0 && (
        <Notice tone="warning" title="Some certificate designs are not published">
          {missing.map(([type]) => templateNames[type] ?? type).join(", ")}: students and judges will see &ldquo;your certificate is being prepared&rdquo; until you publish them on the Certificates page.
        </Notice>
      )}
      {data.unprintableNames.length > 0 && (
        <Notice tone="warning" title={`${plural(data.unprintableNames.length, "student")} with a name the certificate cannot print`}>
          Their certificate uses the name of their Google account (or the part of the name that can be printed). Fix the name on the Students page first if
          that is not right: {data.unprintableNames.slice(0, 8).join(", ")}
          {data.unprintableNames.length > 8 ? ` and ${data.unprintableNames.length - 8} more` : ""}.
        </Notice>
      )}
      {data.groups.some((g) => g.tieAtCut) && (
        <Notice tone="warning" title="A tie at the winning places">
          {data.groups
            .filter((g) => g.tieAtCut)
            .map((g) => `${departmentLabel(g.department)} PS ${g.category}`)
            .join(", ")}
          : a team just outside the winning places is level with the last winner. The release takes the team ranked higher; if a department admin or you want to decide it, declare the winner on the Judging page first and the release keeps it.
        </Notice>
      )}
      {data.winnerTeams === 0 && <Notice tone="error">No team has been scored by every judge of its room yet, so there is nothing to release.</Notice>}

      {noWinner.length > 0 && (
        <div>
          <h3 className="font-semibold text-navy-900">No winner will be announced in</h3>
          <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto text-muted">
            {noWinner.map((g) => (
              <li key={`${g.department}-${g.category}`}>
                <span className="font-semibold text-navy-900">
                  {departmentLabel(g.department)} · PS {g.category}
                </span>
                : {g.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="font-semibold text-navy-900">Winners</h3>
        <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto">
          {data.groups
            .filter((g) => g.winners.length > 0)
            .map((g) => (
              <li key={`${g.department}-${g.category}`} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-navy-900">
                  {departmentLabel(g.department)} · PS {g.category}
                </span>
                {g.winners.map((w) => (
                  <Pill key={w.teamCode} tone={w.place === 1 ? "orange" : "slate"}>
                    {w.place === 1 ? "1st" : "2nd"} {w.teamName} ({w.teamCode})
                  </Pill>
                ))}
                {g.declaredByHand && <span className="text-xs text-muted">declared by hand</span>}
                {g.tieAtCut && <span className="text-xs font-semibold text-amber-700">tie at the cut</span>}
                {g.notRanked > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                    <TriangleAlert className="size-3" aria-hidden="true" />
                    {plural(g.notRanked, "team")} not fully scored
                  </span>
                )}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
