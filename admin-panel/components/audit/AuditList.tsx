import Link from "next/link";
import type { AuditEntry } from "@/lib/admin-types";
import { auditLabels, formatDateTime } from "@/lib/format";
import { Pill, type PillTone } from "@/components/ui/Pill";

const tones: Partial<Record<string, PillTone>> = {
  "team.submitted": "green",
  "team.withdrawn": "red",
  "team.disqualified": "red",
  "team.restored": "cyan",
  "team.deleted": "red",
  "member.left": "red",
  "member.removed": "red",
  "finalists.updated": "orange",
  "results.published": "orange",
  "admin.added": "navy",
  "admin.removed": "navy",
};

/** A ruled, newest-first list of audit log entries. */
export function AuditList({ entries, showTeam = true }: { entries: AuditEntry[]; showTeam?: boolean }) {
  return (
    <ol className="divide-y divide-line border-y border-line">
      {entries.map((entry) => (
        <li key={entry.id} className="grid gap-1 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
          <time dateTime={entry.at} className="text-xs tabular-nums text-muted sm:pt-0.5">
            {formatDateTime(entry.at)}
          </time>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* Unknown (future) actions fall back to the raw action string. */}
              <Pill tone={tones[entry.action] ?? "slate"}>{(auditLabels as Record<string, string>)[entry.action] ?? entry.action}</Pill>
              {showTeam && entry.teamId && entry.teamCode && (
                <Link href={`/teams/${entry.teamId}`} className="text-xs font-semibold text-brand-700 hover:underline">
                  {entry.teamCode}
                </Link>
              )}
              {entry.department && <span className="text-xs text-muted">{entry.department}</span>}
            </div>
            <p className="mt-1 text-sm break-words text-navy-900">{entry.detail}</p>
            <p className="mt-0.5 text-xs break-all text-muted">by {entry.actorEmail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
