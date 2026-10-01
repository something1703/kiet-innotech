/**
 * Data shapes used only by the admin panel. Shared shapes (Team, Profile, ...) live in types.ts,
 * which is a verbatim copy of the student portal's file.
 * All of these mirror the backend JSON after snake_case keys are converted to camelCase in lib/api/live.ts.
 */
import type { ParticipantType, Profile, Team, TeamMember, TeamResult, TeamRoute, TeamStatus } from "./types";

export type AdminRole = "super_admin" | "admin";

export type AdminUser = {
  email: string;
  name: string;
  role: AdminRole;
  /** The KIET department an admin is scoped to. Always null for a super admin. */
  department: string | null;
  /** Null for super admins set in the server configuration. */
  addedAt?: string | null;
  /** An admin's email, or CONFIGURED_BY_SERVER. */
  addedBy?: string | null;
};

/** `addedBy` of super admins listed in the backend's configuration. They cannot be removed from the panel. */
export const CONFIGURED_BY_SERVER = "server configuration";

export type AdminInput = Pick<AdminUser, "email" | "name" | "role" | "department">;

export type AuditAction =
  | "team.created"
  | "team.submitted"
  | "team.withdrawn"
  | "team.disqualified"
  | "team.restored"
  | "team.updated"
  | "team.deleted"
  | "member.joined"
  | "member.left"
  | "member.removed"
  | "invitation.sent"
  | "invitation.cancelled"
  | "invitation.declined"
  | "finalists.updated"
  | "results.published"
  | "admin.added"
  | "admin.removed"
  | "team.code_reset";

export type AuditEntry = {
  id: string;
  at: string;
  actorEmail: string;
  action: AuditAction;
  teamId?: string | null;
  teamCode?: string | null;
  /** Department the entry belongs to, used to scope the log for department admins. Null = institute-wide. */
  department?: string | null;
  detail: string;
};

/** A team member as admins see it: the student portal's member plus contact and roll details. */
export type AdminTeamMember = TeamMember & {
  phone: string;
  rollNumber: string;
  institution: string;
};

export type AdminTeam = Omit<Team, "members"> & {
  members: AdminTeamMember[];
};

/** A registered student plus a short reference to their team, if any. */
export type AdminStudent = Profile & {
  team: {
    id: string;
    code: string;
    name: string;
    status: TeamStatus;
    /** The team's department (the leader's), which can differ from the student's in mixed-branch teams. */
    department: string | null;
    role: "leader" | "member";
  } | null;
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type SortOrder = "asc" | "desc";

export type TeamSort = "code" | "name" | "category" | "department" | "status" | "members" | "submitted_at";

export type TeamQuery = {
  department?: string;
  category?: number;
  status?: TeamStatus;
  type?: ParticipantType;
  route?: TeamRoute;
  q?: string;
  sort?: TeamSort;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
};

export type StudentSort = "name" | "email" | "department" | "year" | "institution" | "created_at";

export type StudentQuery = {
  department?: string;
  type?: ParticipantType;
  year?: number;
  /** "yes" = in a team (any status), "no" = not in a team. */
  inTeam?: "yes" | "no";
  q?: string;
  sort?: StudentSort;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
};

export type StatusCounts = {
  total: number;
  draft: number;
  submitted: number;
  withdrawn: number;
  disqualified: number;
};

export type Stats = {
  /** Department the numbers are scoped to; null means institute-wide (super admin). */
  department: string | null;
  students: number;
  studentsInTeams: number;
  pendingInvitations: number;
  teams: StatusCounts;
  /** Super admin only. */
  byType: { type: ParticipantType; students: number; teams: number; submitted: number }[] | null;
  byCategory: ({ category: number } & StatusCounts)[];
  /** Super admin only. KIET departments. */
  byDepartment: ({ department: string; students: number } & StatusCounts)[] | null;
  recentSubmissions: TeamSummary[];
  resultsPublishedAt: string | null;
};

/** A compact team row used in stats and finalist lists. */
export type TeamSummary = {
  id: string;
  code: string;
  name: string;
  category: number;
  participantType: ParticipantType;
  institution: string;
  department: string | null;
  route: TeamRoute;
  status: TeamStatus;
  result: TeamResult;
  leaderName: string;
  memberCount: number;
  projectTitle: string;
  submittedAt: string | null;
};

export type FinalistCategory = {
  category: number;
  quota: number;
  /** Submitted department-route teams of this department in this category. */
  teams: TeamSummary[];
  /** IDs of the nominated teams, at most `quota`. */
  nominated: string[];
};

export type FinalistBoard = {
  department: string;
  /** Set once the super admin publishes results; nominations are then read-only. */
  publishedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  categories: FinalistCategory[];
};

export type NominationInput = { category: number; teamIds: string[] }[];

export type FinalistSummary = {
  publishedAt: string | null;
  publishedBy: string | null;
  matrix: {
    department: string;
    categories: { category: number; quota: number; nominated: number; eligible: number }[];
  }[];
  /** Submitted teams from other colleges and schools, which go straight to the Grand Finale. */
  directTeams: TeamSummary[];
};

export type PublishResult = {
  publishedAt: string;
  finalists: number;
  notSelected: number;
};
