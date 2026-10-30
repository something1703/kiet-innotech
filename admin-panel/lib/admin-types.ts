/**
 * Data shapes used only by the admin panel. Shared shapes (Team, Profile, ...) live in types.ts,
 * which is a verbatim copy of the student portal's file.
 * All of these mirror the backend JSON after snake_case keys are converted to camelCase in lib/api/live.ts.
 */
import type { ParticipantType, Profile, Team, TeamMember, TeamResult, TeamRoute, TeamStatus } from "./types";

/**
 * Organiser roles. A department admin sees one KIET department (COE KIET is one of them); an outside admin other
 * colleges and schools; a college admin other colleges only; a school admin schools only; a startup admin only startups.
 * A desk volunteer uses only the Grand Finale event desk (check-in and food coupons).
 */
export type AdminRole = "super_admin" | "admin" | "outside_admin" | "college_admin" | "school_admin" | "startup_admin" | "desk";

export type AdminUser = {
  email: string;
  name: string;
  /** "judge": an appointed judge who is not an organiser; they see only their own judging page. */
  role: AdminRole | "judge";
  /** The KIET department a department admin is scoped to (or a faculty judge belongs to). Null otherwise. */
  department: string | null;
  /** True when this account is also an appointed judge. */
  judge?: boolean;
  /** Registration desk volunteers: whether they have a sign-in password, and (only right after being added) the password. */
  hasPassword?: boolean;
  password?: string | null;
  /** Null for super admins set in the server configuration. */
  addedAt?: string | null;
  /** An admin's email, or CONFIGURED_BY_SERVER. */
  addedBy?: string | null;
};

/** `addedBy` of super admins listed in the backend's configuration. They cannot be removed from the panel. */
export const CONFIGURED_BY_SERVER = "server configuration";

export type AdminInput = { email: string; name: string; role: AdminRole; department: string | null };

export type AuditAction =
  | "team.created"
  | "team.submitted"
  | "team.archived"
  | "team.edited"
  | "team.member_added"
  | "team.member_removed"
  | "student.edited"
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
  | "team.code_reset"
  | "schedule.updated"
  | "schedule.opened"
  | "schedule.closed"
  | "results.unpublished"
  | "judging.opened"
  | "judging.locked"
  | "judging.judge_added"
  | "judging.judge_removed"
  | "judging.panel_created"
  | "judging.panel_updated"
  | "judging.panel_deleted"
  | "judging.teams_allotted"
  | "judging.judges_assigned"
  | "judging.score_edited"
  | "judging.marks_locked"
  | "judging.marks_unlocked"
  | "judging.buffer_changed"
  | "judging.time_extended"
  | "judging.judge_present"
  | "judging.judge_unmarked"
  | "judging.timetable_updated"
  | "judging.award_declared"
  | "judging.award_removed"
  | "judging.awards_published"
  | "judging.awards_withdrawn"
  | "attendance.marked"
  | "attendance.absent"
  | "attendance.unmarked"
  | "finalists.quotas_updated"
  | "judging.tents_allotted"
  | "judging.scored"
  | "student.created"
  | "student.banned"
  | "student.unbanned"
  | "student.deleted"
  | "team.leader_changed"
  | "team.reopened"
  | "team.dissolved"
  | "team.approved"
  | "team.approval_revoked"
  | "team.rejected"
  | "team.rejection_revoked";

export type ActivityKind = "team" | "member" | "invitation" | "finalists" | "results" | "admin" | "schedule" | "judging" | "attendance" | "student" | "finale" | "desk";

export type ActivityQuery = {
  kind?: ActivityKind;
  department?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

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
  /** Banned from the portal by an organiser. */
  banned?: boolean;
};

export type AdminTeam = Omit<Team, "members"> & {
  members: AdminTeamMember[];
};

/** A registered student plus a short reference to their team, if any. */
export type AdminStudent = Profile & {
  /** Department round: marked present or absent by the judges in the team's room. Null when the team has no room. */
  attendance?: "present" | "absent" | "not_marked" | null;
  /** Set when an organiser has banned the student from the portal. */
  bannedAt?: string | null;
  bannedReason?: string | null;
  bannedBy?: string | null;
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

export type TeamSort = "code" | "name" | "category" | "department" | "status" | "members" | "submitted_at" | "leader_year";

export type TeamQuery = {
  department?: string;
  category?: number;
  status?: TeamStatus;
  type?: ParticipantType;
  route?: TeamRoute;
  /** Startup and COE KIET entries: waiting for an admin to accept them, or already accepted. */
  approval?: "pending" | "approved" | "rejected";
  /** Department round result (finalist, not selected). */
  result?: TeamResult;
  /** Teams with at least one member in this year (college) or class (school). */
  year?: number;
  /** Teams whose leader is in this year or class. */
  leaderYear?: number;
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
  /** "yes" = banned students only, "no" = everyone else. */
  banned?: "yes" | "no";
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
  archived: number;
};

export type Stats = {
  /** Department the numbers are scoped to; null means institute-wide (super admin). */
  department: string | null;
  /** Submitted startup and COE KIET entries waiting for an admin to accept them. */
  awaitingApproval: number;
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
  /** One entry per day (IST), oldest first, from registration opening to today. */
  timeline: TimelinePoint[];
  /** Students per year, plus active teams led by that year and active teams with at least one member of it. */
  byYear: { participantType: ParticipantType; year: number; students: number; teamsLed: number; teamsWith: number }[];
  /** Active teams (draft or submitted) by number of members, sizes 1 to 5. */
  teamSizes: { size: number; teams: number }[];
  /** Active teams by project domain, most popular first. */
  byDomain: { domain: string; teams: number }[];
  /** Super admin only: other colleges and schools with the most registered students. */
  topInstitutions: { institution: string; participantType: ParticipantType; city: string; students: number; teams: number }[] | null;
  schedule: Schedule;
};

export type RegistrationState = "upcoming" | "open" | "closed";

/** The registration window as the server enforces it. */
export type RegistrationWindow = {
  state: RegistrationState;
  /** ISO 8601 with an offset. */
  opens: string;
  closes: string;
};

/** The event schedule an organiser can change: registration window and the finalist nominations deadline. */
export type Schedule = {
  registration: RegistrationWindow;
  /** Other colleges and schools can register until this, later than KIET (COE KIET included) and startups. Null = no extension. */
  extendedCloses: string | null;
  nominationsDeadline: string | null;
  /** False once the deadline has passed (department admins are then locked out of nominations). */
  nominationsOpen: boolean;
  /** Results cannot be published before this (finalists are declared on 26 October). Null = no restriction. */
  resultsPublishFrom: string | null;
  resultsDue: boolean;
  /** True once an organiser saved a change; false while the planned dates apply. */
  customised: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  /** The server's clock, so the page never depends on the browser's. */
  serverTime: string;
  planned: {
    registrationOpens: string;
    registrationCloses: string;
    registrationExtendedCloses: string | null;
    nominationsDeadline: string | null;
    resultsPublishFrom: string | null;
  };
};

export type ScheduleInput = {
  registrationOpens: string;
  registrationCloses: string;
  /** Left out: unchanged; null removes the later deadline for other colleges and schools. */
  registrationExtendedCloses?: string | null;
  nominationsDeadline: string | null;
  /** Left out: unchanged. */
  resultsPublishFrom?: string | null;
};

export type TimelinePoint = {
  /** "2026-10-03" */
  date: string;
  /** Profiles completed that day. */
  students: number;
  /** Teams created that day. */
  teams: number;
  /** Teams submitted that day. */
  submitted: number;
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
  /** Startups and COE KIET teams: true until an admin has accepted the entry. */
  approvalRequired: boolean;
  approvedAt: string | null;
  /** Set when the organisers rejected the team: it is not accepted and gets no stall. */
  rejectedAt: string | null;
  submittedAt: string | null;
  leaderYear: number | null;
  /** Every member's year (or class), the leader's first. */
  memberYears: number[];
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
  /** Department admins' nominations are due by then. Null = no deadline. */
  nominationsDeadline: string | null;
  /** True when the deadline has passed and the signed-in admin can no longer change this board (super admins still can). */
  nominationsLocked: boolean;
  /** Set once the super admin publishes results; nominations are then read-only. */
  publishedAt: string | null;
  /** Set once the super admin locks the finalist list for the Grand Finale: nothing on the board changes after that. */
  lockedAt?: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  categories: FinalistCategory[];
};

export type NominationInput = { category: number; teamIds: string[] }[];

export type FinalistSummary = {
  publishedAt: string | null;
  publishedBy: string | null;
  nominationsDeadline: string | null;
  /** Why results cannot be published right now (null = they can). Decided by the server. */
  publishBlocked: string | null;
  resultsPublishFrom: string | null;
  /** Once published: why the results can no longer be withdrawn (null = a super admin can still withdraw them). */
  unpublishBlocked: string | null;
  /** The finalist list for the Grand Finale: when it was locked and by whom, or why it cannot be locked yet. */
  lockedAt: string | null;
  lockedBy: string | null;
  lockBlocked: string | null;
  /** Department winners still taking part (they become the finalists), and winners who no longer are. */
  lockWinners: number;
  lockLeftOut: number;
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

export type LockFinalistsResult = {
  lockedAt: string;
  finalists: number;
  notSelected: number;
  /** Department winners disqualified or withdrawn after the release, so not finalists. */
  leftOut: number;
};

/** One student of a team a super admin adds in one go; the college or school, city and type come from the team. */
export type CompleteTeamMember = {
  email: string;
  fullName: string;
  phone: string;
  department: string | null;
  course: string;
  year: number;
  rollNumber: string;
  club: string;
};

/** Super admin: a whole team and its students in one go (students not registered yet are registered). The first member leads. */
export type CompleteTeamInput = {
  name: string;
  category: number;
  domain: string;
  projectTitle: string;
  abstract: string;
  participantType: ParticipantType;
  institution: string;
  city: string;
  members: CompleteTeamMember[];
  /** A Grand Finale wild card: takes part straight away, at this octonorm (or building and room). */
  wildcard?: boolean;
  octonorm?: string | null;
  building?: string;
  room?: string;
};

/** An organiser creates a team for registered students, whether or not registration is open. */
export type AdminTeamInput = {
  name: string;
  category: number;
  domain: string;
  projectTitle: string;
  abstract: string;
  leaderEmail: string;
  memberEmails: string[];
  submit: boolean;
};

// ---------- Judging ----------

export type JudgingRound = "department" | "final";

export type Juror = {
  email: string;
  name: string;
  kind: "faculty" | "external";
  department: string | null;
  organisation: string;
  phone: string;
  /** Every room and panel the judge sits in, with its time: a judge can be in many, one at a time. */
  panels: { id: string; round: JudgingRound; building: string; name: string; department: string | null; slotStart: string | null; slotEnd: string | null; parentDepartment: boolean }[];
  scores: number;
  addedAt: string | null;
  addedBy: string | null;
  /** Outside judges sign in with their email and a password; when it was last set. */
  hasPassword: boolean;
  passwordSetAt: string | null;
  /** Only right after an outside judge was appointed: their new password, shown once. */
  password?: string | null;
};

/** A judge's new sign-in password, shown once (only its hash is stored). */
export type JurorPassword = { email: string; name: string; password: string };

/** A sign-in account a super admin made (an outside judge or a registration desk volunteer), with its password when it is kept. */
export type Credential = {
  email: string;
  name: string;
  kind: "judge" | "desk";
  /** The judge's organisation or department, or "Registration desk". */
  detail: string;
  phone: string;
  /** Null when there is none to show: the account has no password, or it was made before passwords could be looked up. */
  password: string | null;
  hasPassword: boolean;
  passwordSetAt: string | null;
  passwordSetBy: string | null;
  /** A judge's Grand Finale panel(s), e.g. "Panel 3 · Octonorms 23-32". */
  panels: string[];
};
export type CredentialRef = { email: string; kind: Credential["kind"] };
export type CredentialReset = { credentials: Credential[]; skipped: string[] };

export type JudgeImportItem = { name: string; email: string; organisation: string; phone: string };

export type JudgeImportRow = {
  email: string;
  name: string;
  /** created: appointed now; passwordAdded: was a judge without a password; exists: already had one (unchanged, no password shown). */
  status: "created" | "password_added" | "exists";
  password: string | null;
};

export type JurorInput = Pick<Juror, "email" | "name" | "kind" | "department" | "organisation" | "phone">;

export type PanelJuror = Pick<Juror, "email" | "name" | "kind" | "department" | "organisation"> & {
  /** A department room's parent department judge: the one from the room's own department. */
  parentDepartment: boolean;
  /** The judge locked all their marks in this room (or its time is over). */
  locked: boolean;
  /** When an organiser marked the judge present in this room, and who. */
  presentAt: string | null;
  presentBy: string | null;
};

/** One judge's submitted marks for a team (super admins only). */
export type PanelScore = {
  jurorEmail: string;
  jurorName: string;
  marks: number[];
  total: number;
  remarks: string;
  updatedAt: string;
  /** The organiser who changed or entered the judge's marks, if any. */
  editedBy: string | null;
  /** How often the saved marks were changed afterwards, and why (the last time). Shown highlighted. */
  editCount: number;
  editReason: string | null;
  locked: boolean;
};

export type PanelTeam = TeamSummary & {
  tent: string | null;
  /** Scores recorded by this panel's judges, and their average total out of 50. */
  scores: number;
  average: number | null;
  /** Each judge's marks: super admins only, null for everyone else. */
  judgeScores: PanelScore[] | null;
  /** Members marked present for this round. */
  present: number;
  /** Department round: each student's attendance, how many are marked absent, and whether all are (the team scores 0). */
  members: PresenceMember[];
  absent: number;
  allAbsent: boolean;
};

/** A judging room (department round, one department's teams, in a building at a time slot) or a Grand Finale panel. */
export type Panel = {
  id: string;
  round: JudgingRound;
  building: string;
  /** The room's name or number (a finale panel's name). */
  name: string;
  /** Optional directions, e.g. "2nd floor, next to the lift". */
  location: string;
  slotStart: string | null;
  slotEnd: string | null;
  department: string | null;
  jurors: PanelJuror[];
  teams: PanelTeam[];
  /** Super admins, and department admins for their own rooms. */
  canEdit: boolean;
  /** Department rooms: judges submit marks from the slot's start until this moment (slot end + the room's buffer). */
  scoringUntil: string | null;
  /** Set when a super admin extended this room's judging time past its slot and buffer. */
  extendedUntil?: string | null;
  /** Extra minutes after the slot in which the room's judges can still submit marks (0 to 60). */
  bufferMinutes: number;
  /** Whether the viewer may change the judges' marks in this room right now (super admins always; the department's own admin during the slot and buffer). */
  canEditMarks: boolean;
};

/** One department's slot in the department round timetable (null: no slot yet). */
export type TimetableSlot = { department: string; slotStart: string | null; slotEnd: string | null };

export type Timetable = {
  slots: TimetableSlot[];
  customised: boolean;
  updatedBy: string | null;
};

export type RoundState = {
  round: JudgingRound;
  open: boolean;
  changedAt: string | null;
  changedBy: string | null;
  /** Why the round cannot be opened now (null = it can, or it is open). */
  openBlocked: string | null;
};

export type Judging = {
  round: RoundState;
  /** Super admins: open and lock rounds, allot stalls, see and change every judge's marks. */
  canManage: boolean;
  /** Can create rooms in this round (department admins: for their own department). */
  canCreate: boolean;
  panels: Panel[];
  unallotted: TeamSummary[];
  /** Final round only: every Grand Finale team and its stall (the field is still called tent). */
  tents: { team: TeamSummary; tent: string | null }[] | null;
  /** Department round: each department's slot. */
  timetable: Timetable | null;
  serverTime: string | null;
};

/** Where and when a room sits. Times are ISO 8601 with an offset. */
export type PanelPlace = { building: string; name: string; location: string; slotStart: string | null; slotEnd: string | null; bufferMinutes: number };

export type PanelInput = PanelPlace & { round: JudgingRound; department: string | null };

/** A student's attendance in the department round: present, absent, or not marked (counted present). */
export type AttendanceState = "present" | "absent" | "not_marked";

export type PresenceMember = {
  userId: string;
  fullName: string;
  role: "leader" | "member";
  state: AttendanceState;
  markedBy: string | null;
  markedAt: string | null;
};

/** A team's students after a change of attendance. When every one is absent the team scores 0. */
/** One problem statement of one department in the release preview: who wins it, or why nobody does. */
export type ReleaseGroup = {
  department: string;
  category: number;
  title: string;
  /** The winning places: 1, or 2 where the department has two. */
  places: number;
  winners: { place: number; teamName: string; teamCode: string; average: number | null; prize: number }[];
  /** Winners a department admin or super admin declared by hand, kept as declared. */
  declaredByHand: boolean;
  reason: string | null;
  /** Teams that were neither absent nor scored by every judge: they cannot be ranked. */
  notRanked: number;
  /** A team just outside the winning places is level with the last winner: an admin should decide it before the release. */
  tieAtCut: boolean;
};

/** What releasing the department results would do, and whether it is already done. */
export type ReleaseReadiness = {
  /** Once the finalist list is locked the release can no longer be withdrawn. */
  finalistsLocked?: boolean;
  released: boolean;
  releasedBy: string | null;
  releasedAt: string | null;
  /** Rooms whose judging time has not run out yet. */
  openRooms: number;
  groups: ReleaseGroup[];
  winnerTeams: number;
  groupsWithoutWinner: number;
  students: number;
  present: number;
  absent: number;
  notMarked: number;
  winnerStudents: number;
  participationStudents: number;
  judges: number;
  /** Is the winner / participation / judge certificate design published? */
  templates: Record<string, boolean>;
  /** Students whose name has characters the certificate font cannot draw (Hindi, Tamil, emoji): they get their account name. */
  unprintableNames: string[];
};

export type ReleaseResult = { winners: number; groupsWithoutWinner: number; declared: number };

export type TeamPresence = { teamId: string; members: PresenceMember[]; allAbsent: boolean };

/** One student of the department round, for the attendance list: no team, just who they are and when they are judged. */
export type RollCallRow = {
  userId: string;
  fullName: string;
  rollNumber: string;
  year: number;
  course: string;
  department: string | null;
  slotStart: string | null;
  slotEnd: string | null;
  /** present and absent are marks. not_marked counts as absent until somebody marks the student present. */
  state: AttendanceState;
  markedBy: string | null;
  markedAt: string | null;
};

export type RollCallSlot = { key: string; start: string | null; end: string | null };

export type RollCall = {
  items: RollCallRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Over the department, year, slot and search filters but not the status, so the counts stay put while you filter by status. */
  students: number;
  present: number;
  absent: number;
  notMarked: number;
  /** Students per year over every filter except the year itself; the slots over every filter except the slot. */
  years: Record<string, number>;
  slots: RollCallSlot[];
};

export type RollCallQuery = {
  department?: string;
  year?: number;
  /** A slot's key from RollCall.slots. */
  slot?: string;
  state?: AttendanceState;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type MarkStudentsResult = {
  changed: number;
  /** Already in the state asked for. */
  unchanged: number;
  skipped: { fullName: string; rollNumber: string; reason: string }[];
  notFound: number;
};

export type AttendanceMember = {
  userId: string;
  fullName: string;
  role: "leader" | "member";
  year: number;
  course: string;
  department: string | null;
  institution: string;
  rollNumber: string;
  phone: string;
  /** Marked present for this round: when, by whom and how. */
  presentAt: string | null;
  markedBy: string | null;
  method: "qr" | "manual" | null;
  /** Present, absent, or not marked. */
  state: AttendanceState;
};

export type AttendanceSheet = {
  round: JudgingRound;
  title: string;
  building: string;
  room: string;
  location: string;
  slotStart: string | null;
  slotEnd: string | null;
  jurors: string[];
  teams: {
    code: string;
    name: string;
    category: number;
    projectTitle: string;
    status: TeamStatus;
    tent: string | null;
    institution: string;
    department: string | null;
    /** The room or panel the team is allotted to. */
    room: string | null;
    members: AttendanceMember[];
  }[];
};

/** What the scanner shows after reading an event pass (or marking a student by hand). */
export type ScanResult = {
  result: "marked" | "already";
  student: {
    userId: string;
    fullName: string;
    rollNumber: string;
    course: string;
    year: number;
    department: string | null;
    institution: string;
    participantType: ParticipantType;
    role: "leader" | "member";
  };
  team: TeamSummary;
  room: string | null;
  markedAt: string;
  markedBy: string;
  method: "qr" | "manual";
  /** Something to check, e.g. the team is allotted to another room. */
  warning: string | null;
};

export type QuotaCell = { department: string; category: number; quota: number };

export type RankedTeam = {
  /** Null until the team has a score. */
  position: number | null;
  team: TeamSummary;
  panel: string | null;
  scores: number;
  judges: number;
  average: number | null;
  innovation: number | null;
  query: number | null;
  /** Level with the team above on total, innovation and query addressing: the department admin or a super admin (the organisers at the finale) decide. */
  tied: boolean;
  /** Every judge of the room has scored the team; only complete teams get a place. */
  complete: boolean;
  /** Every student is absent: the team scores 0 and gets no place. */
  allAbsent: boolean;
  /** A prize place declared by the organisers. */
  award: { place: number; amount: number; declaredBy: string; declaredAt: string } | null;
};

export type Rankings = {
  round: JudgingRound;
  groups: {
    key: string;
    label: string;
    department: string | null;
    category: number | null;
    teams: RankedTeam[];
    /** Places with a cash prize in this group. */
    prizes: { place: number; amount: number }[];
  }[];
  /** Students see the winners only once a super admin publishes them. */
  awardsPublished: boolean;
  canAward: boolean;
  canPublishAwards: boolean;
};

/** One team on the department round's leaderboard. */
export type LeaderboardTeam = {
  position: number | null;
  team: TeamSummary;
  room: string | null;
  average: number | null;
  innovation: number | null;
  query: number | null;
  scores: number;
  judges: number;
  /** Level with the team above on average, innovation and query addressing: the department admin or a super admin decides. */
  tied: boolean;
  complete: boolean;
  allAbsent: boolean;
  /** Placed within the department's finalist places for this problem statement. */
  inLine: boolean;
  nominated: boolean;
  award: { place: number; amount: number; declaredBy: string; declaredAt: string } | null;
};

export type LeaderboardCategory = {
  category: number;
  title: string;
  /** The department's finalist places in this problem statement. */
  quota: number;
  prize: number | null;
  teams: LeaderboardTeam[];
  scored: number;
  /** The last finalist place is level with the next team. */
  tieAtCut: boolean;
};

export type Leaderboard = {
  departments: { department: string; categories: LeaderboardCategory[]; teams: number; scored: number; finalistPlaces: number; nominated: number }[];
  resultsPublished: boolean;
  nominationsDeadline: string | null;
  generatedAt: string;
};

export type Score = {
  marks: number[];
  total: number;
  remarks: string;
  updatedAt: string;
  editedBy: string | null;
  /** The judge locked their marks, or the room's time is over: the judge cannot change them any more. */
  locked: boolean;
  /** How often the judge changed these marks after saving them. */
  editCount: number;
};

/** After a judge locks their marks: how many teams they locked marks for, and how many have none. */
export type LockResult = { locked: number; unscored: number };

export type JudgeTeam = {
  id: string;
  code: string;
  name: string;
  category: number;
  domain: string;
  projectTitle: string;
  abstract: string;
  participantType: ParticipantType;
  institution: string;
  department: string | null;
  status: TeamStatus;
  tent: string | null;
  /** Grand Finale: the building and room when the team is not at its octonorm, e.g. "B Block · Room 204". */
  place: string;
  members: { userId: string; attendance: AttendanceState; fullName: string; role: "leader" | "member"; year: number; course: string; department: string | null }[];
  /** Every student is absent: the team scores 0 and cannot be marked. */
  allAbsent: boolean;
  myScore: Score | null;
  /** Grand Finale: the other judges who saved marks for this team (names only, never their marks). */
  otherJudges: string[];
  /** Grand Finale: the team's own panel (empty when it is on none), and whether that panel is one of this judge's. */
  panel: string;
  inMyPanel: boolean;
  /** Grand Finale: the section it is ranked in, e.g. "Category 3: Automation and Robotics" or "Technical Clubs". */
  section: string;
  leaderName: string;
  /** COE KIET / technical clubs: the club's name. */
  club: string;
};

/** Every Grand Finale team, for a Grand Finale judge to find and score one that is not in their room. */
export type JudgeFinaleTeams = { teams: JudgeTeam[]; open: boolean; locked: boolean; editsAllowed: boolean };

export type JudgePanel = {
  id: string;
  round: JudgingRound;
  building: string;
  name: string;
  location: string;
  slotStart: string | null;
  slotEnd: string | null;
  department: string | null;
  /** The judge is this department room's parent department judge (from the room's own department). */
  parentDepartment: boolean;
  /** When an organiser marked the judge present in this room. */
  presentAt: string | null;
  /** Scores can be saved only while organisers keep the round open... */
  open: boolean;
  /** ...and, for a department room, between these moments (its slot plus the room's buffer). */
  scoringFrom: string | null;
  scoringUntil: string | null;
  /** Extra minutes after the slot in which marks can still be submitted. */
  bufferMinutes: number;
  /** The judge can mark or change students' attendance now (department round, judging open, during the room's time). */
  canMarkAttendance: boolean;
  /** The judge locked all their marks here, or the room's time is over. */
  locked: boolean;
  /** Grand Finale: the judge may change marks already saved (a super admin's switch). Always true in the department round. */
  editsAllowed: boolean;
  teams: JudgeTeam[];
};

export type JudgeView = { email: string; name: string; panels: JudgePanel[]; serverTime: string };

/** An organiser registers a student: the portal's profile fields plus the student's Google email. */
export type AdminStudentInput = {
  email: string;
  fullName: string;
  phone: string;
  participantType: ParticipantType;
  /** COE KIET / technical clubs: the club's name. */
  club: string;
  institution: string;
  city: string;
  department: string | null;
  course: string;
  year: number;
  rollNumber: string;
};

/** The outcome of archiving draft teams: how many were archived, and which were skipped and why. */
export type ArchiveResult = {
  archived: number;
  skipped: { code: string; name: string; reason: string }[];
  notFound: number;
};

/** The outcome of accepting teams for the Grand Finale (or putting them back in the queue): how many changed, and which were skipped and why. */
export type AcceptResult = {
  changed: number;
  skipped: { code: string; name: string; reason: string }[];
  notFound: number;
};

/** One action for many teams at once; each team changes on its own, and those that cannot are skipped with the reason. */
export type BulkAction = "withdraw" | "disqualify" | "restore" | "archive" | "submit" | "accept" | "unaccept" | "reject";

export type BulkResult = {
  action: BulkAction;
  changed: number;
  skipped: { code: string; name: string; reason: string }[];
  notFound: number;
};

/** A super admin corrects a student's profile (the sign-in email stays). */
export type StudentEditInput = Omit<AdminStudentInput, "email"> & { reason: string };

/** A super admin edits a team's details. */
export type TeamEditInput = { name: string; category: number; domain: string; projectTitle: string; abstract: string; reason: string };

/** One department's progress setting up its department-round rooms (counts only). */
export type ReadinessRow = {
  department: string;
  teams: number;
  allotted: number;
  rooms: number;
  /** Rooms with both judges. */
  staffed: number;
  percent: number;
  ready: boolean;
  rank: number;
};

export type Readiness = { rows: ReadinessRow[]; /** The caller's own department, for a department admin. */ mine: string | null };

export type CertificateKind = "judge" | "participation" | "winner";
export type CertificateScope = "department" | "institute";
export type CertificateType =
  | "dept_judge"
  | "dept_participation"
  | "dept_winner"
  | "institute_judge"
  | "institute_participation"
  | "institute_winner";

export type CertificateField = {
  id: string;
  label: string;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  font: string;
  fontsize: number;
  color: string;
  align: number;
  rotation: number;
  lineheight: number;
  defaultText: string;
  sourceKey: string | null;
};

export type CertificateTemplate = {
  id: string;
  type: CertificateType;
  scope: CertificateScope;
  kind: CertificateKind;
  name: string;
  pageWidthPt: number;
  pageHeightPt: number;
  fields: CertificateField[];
  isPublished: boolean;
  hasPreview: boolean;
};

export type CertificateFont = { id: string; name: string; isBuiltin: boolean };

export type CertificateFieldInput = Omit<CertificateField, "sourceKey"> & { sourceKey?: string | null };

export type CertificateAvailability = { type: CertificateType; available: boolean; reason: string | null };

// ---------- Grand Finale event desk ----------

export type DeskMember = {
  userId: string;
  fullName: string;
  role: "leader" | "member";
  course: string;
  year: number;
  department: string | null;
  rollNumber: string;
  /** Where the student is from, the college, school or startup name, and the club of a COE KIET / technical-club student. */
  participantType: ParticipantType;
  institution: string;
  club: string;
  /** The last four digits only, to confirm with the student. */
  phone: string;
  banned: boolean;
  checkedInAt: string | null;
  checkedInBy: string | null;
  /** Meal key -> when the coupon was given. */
  coupons: Record<string, string>;
  /** The paper ID card and lunch coupon the registration desk handed over (registered students only). */
  idCardAt: string | null;
  couponAt: string | null;
};

export type DeskTeam = {
  id: string;
  code: string;
  name: string;
  category: number;
  projectTitle: string;
  participantType: ParticipantType;
  institution: string;
  department: string | null;
  route: TeamRoute;
  tent: string | null;
  /** Where the team exhibits when not at its octonorm, e.g. "B Block · Room 204". */
  place: string;
  section: FinaleSection;
  members: DeskMember[];
};

export type Meal = { key: string; label: string; open: boolean; given: number; extras: number };

export type MealExtra = { id: string; meal: string; quantity: number; recipient: string; issuedAt: string; issuedBy: string };

export type Desk = {
  teams: number;
  teamsCheckedIn: number;
  students: number;
  studentsCheckedIn: number;
  idCards: number;
  coupons: number;
  meals: Meal[];
  extras: MealExtra[];
  /** Super admins set up meals and take coupons back; desk volunteers check in and give coupons. */
  canManage: boolean;
  serverTime: string;
};

export type CouponsResult = { team: DeskTeam; given: string[]; already: string[]; notCheckedIn: string[] };

// ---------- Grand Finale section (super admins) ----------

/** One planned (or made) Grand Finale panel: one judge over a run of consecutive octonorms. */
export type FinaleAllotPanel = { name: string; venue: string; jurorEmail: string; jurorName: string; first: string; last: string; teams: number };
export type FinaleAllot = { panels: FinaleAllotPanel[]; applied: boolean; onAPanel: string[]; noOctonorm: string[] };

export type FinaleSection = "category" | "coe" | "club" | "school" | "college" | "startup";

export type FinaleTeam = {
  team: TeamSummary;
  /** The octonorm (stall) number, and the building and room when the team exhibits somewhere else. */
  octonorm: string | null;
  building: string;
  room: string;
  /** COE KIET / technical clubs: the club's name. */
  club: string;
  /** The section the team is ranked in, and the one it has by itself. */
  section: FinaleSection;
  defaultSection: FinaleSection;
  wildcard: boolean;
  panelId: string | null;
  panel: string | null;
  judges: number;
  scores: number;
  /** Every judge with Grand Finale marks saved for the team, also ones no longer on its panel. */
  markedBy: string[];
  members: number;
  /** Members the registration desk registered, and the ID cards and lunch coupons it handed out. */
  registered: number;
  idCards: number;
  coupons: number;
};

export type Finale = {
  teams: FinaleTeam[];
  sections: Record<FinaleSection, string>;
  roundOpen: boolean;
  /** Grand Finale judges may change the marks they already saved. */
  judgesCanEdit: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
};

export type FinaleEntryInput = { teamId: string; octonorm: string | null; building: string; room: string; section: FinaleSection | null };

export type FinaleWinner = { place: number; teamId: string; teamName: string; teamCode: string; octonorm: string | null; average: number | null; amount: number };

export type FinaleGroup = {
  key: string;
  label: string;
  teams: number;
  /** Teams not yet scored by every judge of their panel. */
  notRanked: number;
  winners: FinaleWinner[];
  declaredByHand: boolean;
  /** The first team after the named places is level with the last one. */
  tieAtCut: boolean;
};

export type FinaleResults = { publishedAt: string | null; publishedBy: string | null; roundOpen: boolean; groups: FinaleGroup[] };

/** The registration desk: who of the team is here, and who got their ID card and lunch coupon. */
export type RegistrationInput = { userId: string; present: boolean; idCard: boolean; coupon: boolean };

// ---------- Importing the octonorm list (super admins) ----------

export type OctonormCandidate = { team: TeamSummary; octonorm: string | null; club: string; score: number };

export type OctonormImportRow = {
  octonorm: string;
  /** The sheet's section: category (department winners), coe, club, school, college or startup. */
  section: FinaleSection;
  category: number | null;
  label: string;
  code: string | null;
  /** same: already has this octonorm; change: would get it; unmatched: choose the team; not_in_finale: not taking part. */
  status: "same" | "change" | "unmatched" | "not_in_finale";
  team: TeamSummary | null;
  current: string | null;
  sectionNow: FinaleSection | null;
  heldBy: string | null;
  candidates: OctonormCandidate[];
  note: string | null;
};

export type OctonormImport = { rows: OctonormImportRow[]; notInSheet: OctonormCandidate[] };
