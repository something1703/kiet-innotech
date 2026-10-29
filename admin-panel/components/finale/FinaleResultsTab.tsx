"use client";

import { useState } from "react";
import { Eye, EyeOff, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, ordinal } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { RankingsTab } from "@/components/judging/RankingsTab";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Loading, Notice } from "@/components/ui/Notice";
import { SectionTitle } from "@/components/ui/PageHeader";

const placeTone = ["bg-accent-500 text-white", "bg-slate-300 text-navy-900", "bg-amber-700 text-white"];

/**
 * The Grand Finale results: 1st and 2nd of every section as the marks stand, published with one button (typed PUBLISH).
 * Publishing locks judging; after it only a super admin changes marks, and the winners follow. Below, the full rankings.
 */
export function FinaleResultsTab({ onChanged }: { onChanged: () => void }) {
  const results = useQuery("finale-results", () => api.finaleResults());
  const [confirming, setConfirming] = useState<"publish" | "unpublish" | null>(null);
  const [nonce, setNonce] = useState(0);
  const data = results.data;
  const named = data?.groups.reduce((sum, g) => sum + g.winners.length, 0) ?? 0;
  const waiting = data?.groups.reduce((sum, g) => sum + g.notRanked, 0) ?? 0;
  const ties = data?.groups.filter((g) => g.tieAtCut) ?? [];

  return (
    <div className="space-y-6">
      {results.error && <Notice tone="error">{results.error}</Notice>}
      {!data && !results.error && <Loading label="Working out the winners" />}
      {data && (
        <section aria-labelledby="publish-title" className={`rounded-2xl px-4 py-4 ring-1 sm:px-5 ${data.publishedAt ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-line"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <h2 id="publish-title" className="flex items-center gap-2 font-display text-lg font-bold text-navy-900">
                <Trophy aria-hidden="true" className="size-5 text-accent-500" />
                {data.publishedAt ? "Grand Finale results are published" : "Publish the Grand Finale results"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {data.publishedAt
                  ? `Published ${formatDateTime(data.publishedAt)} by ${data.publishedBy}. Students see their result; judges can no longer change marks. If you change a mark, the winners follow at once.`
                  : "Names 1st and 2nd of every section from the marks below, shows the results to students and locks judging. Afterwards only a super admin can change marks."}
              </p>
              {!data.publishedAt && waiting > 0 && (
                <p className="mt-2 text-sm font-semibold text-accent-600">
                  {waiting} team{waiting === 1 ? " is" : "s are"} not yet marked by every judge of their panel, so not ranked.
                </p>
              )}
              {ties.length > 0 && (
                <p className="mt-2 text-sm font-semibold text-accent-600">
                  Level teams in {ties.map((g) => g.label).join(", ")}: same average, innovation and query addressing, so the marks cannot split them. Decide
                  the places in the full rankings below (Make 1st / Make 2nd) before publishing.
                </p>
              )}
            </div>
            {data.publishedAt ? (
              <Button variant="secondary" onClick={() => setConfirming("unpublish")}>
                <EyeOff aria-hidden="true" className="size-4" />
                Hide results
              </Button>
            ) : (
              <Button onClick={() => setConfirming("publish")} disabled={named === 0}>
                <Eye aria-hidden="true" className="size-4" />
                Publish results
              </Button>
            )}
          </div>
        </section>
      )}

      {data && (
        <section aria-labelledby="winners-title">
          <SectionTitle id="winners-title" title={data.publishedAt ? "Winners" : "Winners as the marks stand now"} meta={`${named} places named`} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.groups.map((g) => (
              <article key={g.key} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <h3 className="font-display text-sm font-bold text-navy-900">{g.label}</h3>
                <p className="text-xs text-muted">
                  {g.teams} teams{g.notRanked ? ` · ${g.notRanked} not ranked yet` : ""}
                  {g.declaredByHand ? " · declared by hand" : ""}
                </p>
                {g.winners.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No team marked by every judge yet.</p>
                ) : (
                  <ol className="mt-3 space-y-2">
                    {g.winners.map((w) => (
                      <li key={w.teamId} className="flex items-center gap-3">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${placeTone[w.place - 1] ?? "bg-surface"}`}>{ordinal(w.place)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-navy-900">{w.teamName}</span>
                          <span className="block text-xs text-muted">
                            {w.teamCode}
                            {w.octonorm ? ` · Octonorm ${w.octonorm}` : ""} · {w.average ?? "—"}/50
                          </span>
                        </span>
                        {w.amount > 0 && <span className="text-xs font-semibold text-accent-600">₹{w.amount.toLocaleString("en-IN")}</span>}
                      </li>
                    ))}
                  </ol>
                )}
                {g.tieAtCut && <p className="mt-2 text-xs font-semibold text-accent-600">Level teams: decide the places by hand before publishing.</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="rankings-title">
        <SectionTitle id="rankings-title" title="Full rankings" meta="Average of the panel's judges, out of 50" />
        <RankingsTab key={nonce} round="final" inFinale />
      </section>

      {confirming === "publish" && (
        <ConfirmDialog
          title="Publish the Grand Finale results?"
          description="The winners shown above are named, students see their results, and Grand Finale judging is locked. Judges can no longer change marks."
          confirmLabel="Publish results"
          typeToConfirm="PUBLISH"
          onClose={() => setConfirming(null)}
          onConfirm={async () => {
            results.setData(await api.publishFinale());
            setConfirming(null);
            setNonce((n) => n + 1);
            onChanged();
          }}
        />
      )}
      {confirming === "unpublish" && (
        <ConfirmDialog
          title="Hide the Grand Finale results?"
          description="Students stop seeing the results and the winners publishing named are taken back. Judging stays locked until you open it again."
          confirmLabel="Hide results"
          tone="danger"
          onClose={() => setConfirming(null)}
          onConfirm={async () => {
            results.setData(await api.unpublishFinale(""));
            setConfirming(null);
            setNonce((n) => n + 1);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
