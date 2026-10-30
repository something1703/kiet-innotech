"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { Finale } from "@/lib/admin-types";
import { useQuery } from "@/lib/use-query";
import { JurorsTab } from "@/components/judging/JurorsTab";
import { RoundBar } from "@/components/judging/JudgingView";
import { PanelsTab } from "@/components/judging/PanelsTab";
import { Button } from "@/components/ui/Button";
import { AllotJudgesDialog } from "./AllotJudgesDialog";
import { Loading, Notice } from "@/components/ui/Notice";
import { SectionTitle } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/Switch";

/**
 * Grand Finale judging, for super admins: open and close scoring (judges can sign in any time but give marks only while it
 * is open, with no time limit otherwise), the switch for judges changing their saved marks, the panels (each a few judges
 * and a range of octonorms) and the judges with their sign-in passwords.
 */
export function FinaleJudgingTab({ finale, onFinale }: { finale: Finale; onFinale: (data: Finale) => void }) {
  const judging = useQuery("judging-final", () => api.judging("final"));
  const [view, setView] = useState<"panels" | "judges">("panels");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allotting, setAllotting] = useState(false);
  const [allotted, setAllotted] = useState<string | null>(null);

  async function setEdits(on: boolean) {
    setPending(true);
    setError(null);
    try {
      onFinale(await api.setFinaleJudgeEdits(on));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {judging.error && <Notice tone="error">{judging.error}</Notice>}
      {!judging.data && !judging.error && <Loading label="Loading finale judging" />}
      {judging.data && <RoundBar judging={judging.data} canManage onChange={judging.reload} />}

      <section aria-labelledby="edits-title" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-4 py-4 ring-1 ring-line sm:px-5">
        <div className="min-w-0 max-w-2xl">
          <h2 id="edits-title" className="font-display text-lg font-bold text-navy-900">
            Judges can change their saved marks
          </h2>
          <p className="mt-1 text-sm text-muted">
            {finale.judgesCanEdit
              ? "On: a judge can correct marks they already saved (with a reason) while judging is open."
              : "Off: judges can still give marks to teams they have not marked yet, but cannot change saved ones. You can always change any mark."}
            {finale.publishedAt && " The results are published, so judges cannot change anything now."}
          </p>
          {error && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p>}
        </div>
        <Switch checked={finale.judgesCanEdit} onChange={setEdits} pending={pending} label="Judges can change their saved marks" />
      </section>

      <div role="tablist" aria-label="Finale judging" className="flex gap-1 border-b border-line">
        {(
          [
            ["panels", "Panels and octonorms"],
            ["judges", "Judges and logins"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${view === key ? "border-accent-500 text-navy-900" : "border-transparent text-muted hover:text-navy-900"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "panels" && judging.data && (
        <section aria-label="Panels">
          <SectionTitle title="Panels" meta="Make a panel, pick its judges, then give it a range of octonorms (about 10 teams)" />
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => (setAllotting(true), setAllotted(null))}>
              <Users aria-hidden="true" className="size-4" />
              Allot judges by stall
            </Button>
            <span className="text-xs text-muted">One judge per panel, stalls shared out in order, one venue per panel.</span>
          </div>
          {allotted && (
            <div className="mb-4">
              <Notice tone="success">{allotted}</Notice>
            </div>
          )}
          <PanelsTab judging={judging.data} reload={judging.reload} />
        </section>
      )}
      {view === "judges" && <JurorsTab canManage onChange={judging.reload} />}
      {allotting && (
        <AllotJudgesDialog
          finale={finale}
          onClose={() => setAllotting(false)}
          onDone={(message) => {
            setAllotting(false);
            setAllotted(message);
            judging.reload();
            api.finale().then(onFinale, () => undefined);
          }}
        />
      )}
    </div>
  );
}
