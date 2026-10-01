import type { AdminRole, AuditAction } from "./admin-types";
import { categories } from "./content";
import { participantTypeLabels } from "./rules";
import type { ParticipantType, TeamResult, TeamRoute, TeamStatus } from "./types";

const TIME_ZONE = "Asia/Kolkata";

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

/** For CSV files: "2026-10-12 14:05 IST". Sorts correctly as text and reads the same everywhere. */
export function formatCsvDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: TIME_ZONE,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} IST`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function categoryTitle(number: number) {
  return categories.find((c) => c.number === number)?.title ?? `Category ${number}`;
}

export const statusLabels: Record<TeamStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  withdrawn: "Withdrawn",
  disqualified: "Disqualified",
};

export const resultLabels: Record<TeamResult, string> = {
  pending: "Result pending",
  finalist: "Finalist",
  not_selected: "Not selected",
};

export const routeLabels: Record<TeamRoute, string> = {
  department: "Department round",
  finale: "Direct to finale",
};

export const roleLabels: Record<AdminRole, string> = {
  super_admin: "Super admin",
  admin: "Department admin",
};

export const typeShortLabels: Record<ParticipantType, string> = {
  kiet: "KIET",
  college: "Other college",
  school: "School",
};

export const auditLabels: Record<AuditAction, string> = {
  "team.created": "Team created",
  "team.submitted": "Team submitted",
  "team.withdrawn": "Team withdrawn",
  "team.disqualified": "Team disqualified",
  "team.restored": "Team restored",
  "team.updated": "Team details edited",
  "team.deleted": "Team deleted",
  "member.joined": "Member joined",
  "member.left": "Member left",
  "member.removed": "Member removed",
  "invitation.sent": "Invitation sent",
  "invitation.cancelled": "Invitation cancelled",
  "invitation.declined": "Invitation declined",
  "finalists.updated": "Finalists updated",
  "results.published": "Results published",
  "admin.added": "Admin added",
  "admin.removed": "Admin removed",
  "team.code_reset": "Team code reset",
  "schedule.updated": "Schedule changed",
  "schedule.opened": "Registration opened",
  "schedule.closed": "Registration closed",
};

export { participantTypeLabels };

export function plural(count: number, one: string, many = `${one}s`) {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

/**
 * Departments of a KIET team's members other than the team's own (the leader's) department.
 * KIET teams may mix branches; an empty list means every member is from the team's department.
 */
export function otherMemberDepartments(team: { department: string | null; members: { department: string | null }[] }) {
  if (!team.department) return [];
  return [...new Set(team.members.map((m) => m.department).filter((d): d is string => !!d && d !== team.department))];
}

// ---------- IST date-time inputs ----------

const IST_OFFSET = "+05:30";

/** An ISO time as the value of a <input type="datetime-local">, in IST ("2026-10-12T23:59"), whatever the browser's zone. */
export function toIstInput(iso: string | null | undefined) {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** The reverse: a datetime-local value read as IST, as an ISO string with the offset. Empty or invalid gives null. */
export function fromIstInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${IST_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : `${value}:00${IST_OFFSET}`;
}

/** e.g. "12 Oct 2026, 11:59 pm IST" */
export function formatIst(iso: string | null | undefined) {
  if (!iso) return "—";
  return `${new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })} IST`;
}
