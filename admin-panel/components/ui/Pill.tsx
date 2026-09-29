import type { ReactNode } from "react";
import { resultLabels, statusLabels } from "@/lib/format";
import type { TeamResult, TeamStatus } from "@/lib/types";

export type PillTone = "slate" | "green" | "red" | "orange" | "cyan" | "navy";

const tones: Record<PillTone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  orange: "bg-accent-50 text-accent-600 ring-accent-100",
  cyan: "bg-brand-50 text-brand-700 ring-brand-100",
  navy: "bg-navy-900 text-white ring-navy-900",
};

export function Pill({ tone = "slate", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

const statusTones: Record<TeamStatus, PillTone> = {
  draft: "slate",
  submitted: "green",
  withdrawn: "red",
  disqualified: "red",
};

export function StatusPill({ status }: { status: TeamStatus }) {
  return <Pill tone={statusTones[status]}>{statusLabels[status]}</Pill>;
}

const resultTones: Record<TeamResult, PillTone> = {
  pending: "slate",
  finalist: "orange",
  not_selected: "slate",
};

export function ResultPill({ result }: { result: TeamResult }) {
  return <Pill tone={resultTones[result]}>{resultLabels[result]}</Pill>;
}
