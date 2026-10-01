import type {
  ActivityQuery,
  AdminInput,
  AdminTeamInput,
  AttendanceSheet,
  JudgeView,
  Judging,
  JudgingRound,
  Juror,
  JurorInput,
  Panel,
  PanelInput,
  Rankings,
  RoundState,
  Score,
  AdminStudent,
  AdminTeam,
  AdminUser,
  AuditEntry,
  FinalistBoard,
  FinalistSummary,
  NominationInput,
  Page,
  PublishResult,
  Schedule,
  ScheduleInput,
  Stats,
  StudentQuery,
  TeamQuery,
} from "../admin-types";

/** Everything the admin panel needs from the backend. The mock and live implementations both satisfy it. */
export interface AdminApi {
  mode: "mock" | "live";

  /** The signed-in admin. Throws ApiError 403 if the account is not an admin. */
  me(): Promise<AdminUser>;
  stats(): Promise<Stats>;

  listTeams(query: TeamQuery): Promise<Page<AdminTeam>>;
  /** Every team matching the filters (no paging), for CSV export. */
  exportTeams(query: TeamQuery): Promise<AdminTeam[]>;
  getTeam(id: string): Promise<AdminTeam>;
  /** Creates a team for registered students, whether or not registration is open. */
  createTeam(input: AdminTeamInput): Promise<AdminTeam>;
  withdrawTeam(id: string, reason: string): Promise<AdminTeam>;
  disqualifyTeam(id: string, reason: string): Promise<AdminTeam>;
  restoreTeam(id: string, reason: string): Promise<AdminTeam>;

  listStudents(query: StudentQuery): Promise<Page<AdminStudent>>;
  exportStudents(query: StudentQuery): Promise<AdminStudent[]>;

  /** Registration window and nominations deadline. Any admin can read it; only a super admin can change it. */
  getSchedule(): Promise<Schedule>;
  saveSchedule(input: ScheduleInput): Promise<Schedule>;
  /** Opens registration immediately. `registrationCloses` is needed only if the closing date has already passed. */
  openRegistrationNow(registrationCloses?: string): Promise<Schedule>;
  closeRegistrationNow(): Promise<Schedule>;

  getFinalists(department: string): Promise<FinalistBoard>;
  saveFinalists(department: string, nominations: NominationInput): Promise<FinalistBoard>;
  finalistSummary(): Promise<FinalistSummary>;
  publishResults(): Promise<PublishResult>;
  /** Withdraws published results (e.g. published by mistake): every department team's result goes back to pending. */
  unpublishResults(reason: string): Promise<void>;

  listAdmins(): Promise<AdminUser[]>;
  addAdmin(input: AdminInput): Promise<AdminUser>;
  removeAdmin(email: string): Promise<void>;

  audit(query?: { teamId?: string; limit?: number }): Promise<AuditEntry[]>;
  /** The whole audit log, newest first, a page at a time. */
  activity(query: ActivityQuery): Promise<Page<AuditEntry>>;

  judging(round: JudgingRound): Promise<Judging>;
  openJudging(round: JudgingRound): Promise<RoundState>;
  lockJudging(round: JudgingRound): Promise<RoundState>;
  rankings(round: JudgingRound, department?: string): Promise<Rankings>;
  attendance(round: JudgingRound, panelId?: string): Promise<AttendanceSheet>;
  setTents(tents: { teamId: string; tent: string | null }[]): Promise<Judging>;
  createPanel(input: PanelInput): Promise<Panel>;
  updatePanel(id: string, input: { name: string; location: string }): Promise<Panel>;
  deletePanel(id: string): Promise<void>;
  setPanelTeams(id: string, teamIds: string[]): Promise<Panel>;
  setPanelJurors(id: string, jurors: { email: string; chair: boolean }[]): Promise<Panel>;
  listJurors(): Promise<Juror[]>;
  addJuror(input: JurorInput): Promise<Juror>;
  removeJuror(email: string): Promise<void>;

  /** A judge's own panels and scores. */
  judgeView(): Promise<JudgeView>;
  saveScore(panelId: string, teamId: string, marks: number[], remarks: string): Promise<Score>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export const DEFAULT_PAGE_SIZE = 25;

/** The backend rejects longer search text with 422. */
export const MAX_SEARCH_LENGTH = 100;
