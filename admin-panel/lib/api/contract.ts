import type {
  AdminInput,
  AdminStudent,
  AdminTeam,
  AdminUser,
  AuditEntry,
  FinalistBoard,
  FinalistSummary,
  NominationInput,
  Page,
  PublishResult,
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
  withdrawTeam(id: string, reason: string): Promise<AdminTeam>;
  disqualifyTeam(id: string, reason: string): Promise<AdminTeam>;
  restoreTeam(id: string, reason: string): Promise<AdminTeam>;

  listStudents(query: StudentQuery): Promise<Page<AdminStudent>>;
  exportStudents(query: StudentQuery): Promise<AdminStudent[]>;

  getFinalists(department: string): Promise<FinalistBoard>;
  saveFinalists(department: string, nominations: NominationInput): Promise<FinalistBoard>;
  finalistSummary(): Promise<FinalistSummary>;
  publishResults(): Promise<PublishResult>;

  listAdmins(): Promise<AdminUser[]>;
  addAdmin(input: AdminInput): Promise<AdminUser>;
  removeAdmin(email: string): Promise<void>;

  audit(query?: { teamId?: string; limit?: number }): Promise<AuditEntry[]>;
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
