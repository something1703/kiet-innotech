import type { DirectFinaleKind } from "@/lib/rules";
import type { Team } from "@/lib/types";
import { Notice } from "@/components/ui/form";
import { MailLink } from "@/components/ui/MailLink";

/**
 * For startups and COE KIET teams, who skip the department round: they are judged directly at the Grand Finale, with
 * nothing to prepare beforehand, and their tent (area) number is allotted to them. They qualify only once an admin has
 * accepted the entry as a legal one, and until then they are told whom to contact.
 */
export function FinaleNote({ kind, team, className }: { kind: DirectFinaleKind; team?: Team | null; className?: string }) {
  const noun = kind === "startup" ? "entry" : "team";
  const finale = (
    <>
      There is no department round and no evaluation to prepare for beforehand. You are judged directly at the Grand Finale on 30 October 2026 at KIET.
      You do not choose a tent: your tent (area) number will be allotted to you before the Grand Finale.
    </>
  );

  if (team?.approvalRequired && team.approvedAt) {
    return (
      <Notice tone="success" title="Approved for the Grand Finale" className={className}>
        An admin has accepted your {noun} as a legal entry, so you qualify for the Grand Finale. {finale}
      </Notice>
    );
  }

  if (team?.approvalRequired) {
    return (
      <Notice tone="warning" title="Waiting for approval" className={className}>
        <p>
          Your {noun} counts as a legal entry for the Grand Finale only once an admin has accepted it, and until then you do not qualify. Please contact
          the coordinator, or write to <MailLink />, to get it accepted.
        </p>
        <p className="mt-2">Once it is accepted: {finale}</p>
      </Notice>
    );
  }

  return (
    <Notice tone="info" title={kind === "startup" ? "Your startup goes directly to the Grand Finale" : "COE KIET teams go directly to the Grand Finale"} className={className}>
      <p>{finale}</p>
      <p className="mt-2">
        After you submit your {noun}, an admin must accept it as a legal entry before it qualifies. Contact the coordinator, or write to <MailLink />, to get it
        accepted.
      </p>
    </Notice>
  );
}
