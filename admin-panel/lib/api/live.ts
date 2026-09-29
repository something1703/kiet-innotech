/**
 * Live admin API client for the FastAPI backend.
 *
 * Base URL: NEXT_PUBLIC_API_URL (no trailing slash). All routes below are relative to it.
 *
 * Conventions
 * - Every request sends `Authorization: Bearer <Cognito ID token>`. The backend verifies the JWT
 *   against the user pool's JWKS (issuer, audience = app client ID, expiry), reads the `email`
 *   claim and looks it up in the admins table. Unknown emails get 403.
 * - Request and response bodies use snake_case keys; this client converts them to and from camelCase.
 *   Query parameter names are snake_case too. Enum values (statuses, sort keys) are sent as-is.
 * - Errors are non-2xx responses with `{ "detail": "Human readable message" }`; `detail` is always a
 *   string, including for 422 (the client still copes with FastAPI's list form just in case).
 *   401 = missing or expired token, 403 = not an admin / outside the admin's scope / super admin only,
 *   404 = not found, 409 = state conflict (e.g. already withdrawn, results already published),
 *   422 = invalid input.
 * - Role scoping, enforced by the backend: role "admin" sees only KIET teams whose `department`
 *   equals the admin's department, KIET students whose own `department` equals it, audit entries
 *   whose `department` equals it, and only that department's finalist board. Passing any other
 *   `department` returns 403, as does opening another department's team by ID.
 *   Role "super_admin" sees everything (all departments, other colleges and schools).
 * - Paged responses: `{ items, total, page, page_size }`. `page` starts at 1; `page_size` defaults
 *   to 25, max 100.
 *
 * Endpoints (request → response; shapes are the types in lib/admin-types.ts and lib/types.ts)
 *
 *   GET    /admin/me
 *          → AdminUser { email, name, role: "super_admin" | "admin", department | null, added_at, added_by }
 *          403 if the signed-in email is not an admin.
 *
 *   GET    /admin/stats
 *          → Stats (scoped to the caller). `by_type` and `by_department` are null for department admins.
 *
 *   GET    /admin/teams?department=&category=&status=&type=&route=&q=&sort=&order=&page=&page_size=
 *          department: KIET department name (e.g. "CSE(AI)"); category: 1-8;
 *          status: draft | submitted | withdrawn | disqualified; type: kiet | college | school;
 *          route: department | finale; q: case-insensitive match on team name, team code,
 *          institution, member names and member emails;
 *          sort: code | name | category | department | status | members | submitted_at (default code);
 *          order: asc | desc (default asc).
 *          → Page<AdminTeam> (members include phone, roll_number, institution; invitations = pending only)
 *
 *   GET    /admin/teams/export?(same filters as /admin/teams, no page/page_size)
 *          → AdminTeam[]  every matching team, used for CSV export.
 *
 *   GET    /admin/teams/{id}
 *          → AdminTeam. 404 unknown, 403 outside the caller's department.
 *
 *   POST   /admin/teams/{id}/withdraw     body { reason }   (admin in scope, super_admin)
 *          Allowed from draft | submitted. Sets status "withdrawn", cancels pending invitations,
 *          removes the team from finalist nominations, writes an audit entry. → AdminTeam
 *
 *   POST   /admin/teams/{id}/disqualify   body { reason }   (super_admin only)
 *          Allowed from draft | submitted. Sets status "disqualified", same side effects. → AdminTeam
 *
 *   POST   /admin/teams/{id}/restore      body { reason }   (super_admin only)
 *          Allowed from withdrawn | disqualified. Status becomes "submitted" if submitted_at is set,
 *          otherwise "draft". → AdminTeam
 *          `reason` is required (at least 5 characters) on all three actions.
 *
 *   GET    /admin/students?department=&type=&year=&in_team=&q=&sort=&order=&page=&page_size=
 *          in_team: yes | no; q matches name, email, roll number, institution, phone;
 *          sort: name | email | department | year | institution | created_at (default name).
 *          → Page<AdminStudent> (Profile + team { id, code, name, status, department, role } | null)
 *
 *   GET    /admin/students/export?(same filters, no paging)
 *          → AdminStudent[]
 *
 *   GET    /admin/finalists?department=
 *          → FinalistBoard { department, published_at, updated_at, updated_by,
 *            categories: [{ category, quota, teams: TeamSummary[], nominated: team_id[] }] }
 *          One entry per category 1-8. `teams` = submitted, route "department" teams of that
 *          department and category. `quota` = finalistQuota(department, category).
 *          403 for another department (department admin), 404 unknown department.
 *
 *   PUT    /admin/finalists/{department}
 *          body { nominations: [{ category, team_ids: string[] }] }  (categories not listed are unchanged)
 *          422 if a category exceeds its quota or a team is not an eligible submitted team of that
 *          department and category; 409 once results are published. → FinalistBoard
 *
 *   GET    /admin/finalists/summary        (super_admin only)
 *          → FinalistSummary { published_at, published_by,
 *            matrix: [{ department, categories: [{ category, quota, nominated, eligible }] }],
 *            direct_teams: TeamSummary[] }  (submitted other-college and school teams)
 *
 *   POST   /admin/results/publish          (super_admin only, once)
 *          Every submitted route "department" team becomes result "finalist" if nominated, else
 *          "not_selected". Finale-route teams are unchanged. Locks nominations. 409 if already published.
 *          → PublishResult { published_at, finalists, not_selected }
 *
 *   GET    /admin/admins                    (super_admin only) → AdminUser[]
 *   POST   /admin/admins                    (super_admin only)
 *          body { email, name, role, department }  department required (a KIET department) when
 *          role = "admin", must be null for "super_admin". 409 if the email is already an admin.
 *          → AdminUser
 *   DELETE /admin/admins/{email}            (super_admin only) → 204. 409 when removing yourself.
 *
 *   GET    /admin/audit?team_id=&limit=
 *          → AuditEntry[] newest first (limit default 50, max 200). Scoped like teams; team_id of a
 *          team outside the caller's scope → 403.
 *          AuditEntry { id, at, actor_email, action, team_id, team_code, department, detail }
 *          id is a string. action: team.created | team.submitted | team.withdrawn | team.disqualified |
 *                  team.restored | finalists.updated | results.published | admin.added | admin.removed,
 *          plus student-portal actions: team.updated | team.deleted | member.joined | member.left |
 *                  member.removed | invitation.sent | invitation.cancelled | invitation.declined.
 *          Unknown future actions render with their raw action string.
 */
import type {
  AdminInput,
  AdminStudent,
  AdminTeam,
  AdminUser,
  AuditEntry,
  FinalistBoard,
  FinalistSummary,
  Page,
  PublishResult,
  Stats,
  StudentQuery,
  TeamQuery,
} from "../admin-types";
import { getIdToken } from "../auth/cognito";
import { ApiError, type AdminApi } from "./contract";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => convertKeys(item, convert));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [convert(key), convertKeys(item, convert)]),
    );
  }
  return value;
}

function queryString(query: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(toSnake(key), String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!BASE_URL) throw new ApiError(0, "NEXT_PUBLIC_API_URL is not set.");
  const token = await getIdToken();
  if (!token) throw new ApiError(401, "Your session has expired. Please sign in again.");
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(convertKeys(body, toSnake)),
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && typeof detail[0]?.msg === "string"
          ? detail[0].msg
          : `Request failed (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  return convertKeys(data, toCamel) as T;
}

const id = (value: string) => encodeURIComponent(value);

/** Export endpoints return every matching row, so paging parameters are dropped. */
function withoutPaging<Q extends { page?: number; pageSize?: number }>(query: Q) {
  const rest = { ...query };
  delete rest.page;
  delete rest.pageSize;
  return rest;
}

export const liveApi: AdminApi = {
  mode: "live",
  me: () => request<AdminUser>("GET", "/admin/me"),
  stats: () => request<Stats>("GET", "/admin/stats"),

  listTeams: (query: TeamQuery) => request<Page<AdminTeam>>("GET", `/admin/teams${queryString(query)}`),
  exportTeams: (query: TeamQuery) => request<AdminTeam[]>("GET", `/admin/teams/export${queryString(withoutPaging(query))}`),
  getTeam: (teamId) => request<AdminTeam>("GET", `/admin/teams/${id(teamId)}`),
  withdrawTeam: (teamId, reason) => request<AdminTeam>("POST", `/admin/teams/${id(teamId)}/withdraw`, { reason }),
  disqualifyTeam: (teamId, reason) => request<AdminTeam>("POST", `/admin/teams/${id(teamId)}/disqualify`, { reason }),
  restoreTeam: (teamId, reason) => request<AdminTeam>("POST", `/admin/teams/${id(teamId)}/restore`, { reason }),

  listStudents: (query: StudentQuery) => request<Page<AdminStudent>>("GET", `/admin/students${queryString(query)}`),
  exportStudents: (query: StudentQuery) =>
    request<AdminStudent[]>("GET", `/admin/students/export${queryString(withoutPaging(query))}`),

  getFinalists: (department) => request<FinalistBoard>("GET", `/admin/finalists${queryString({ department })}`),
  saveFinalists: (department, nominations) =>
    request<FinalistBoard>("PUT", `/admin/finalists/${id(department)}`, { nominations }),
  finalistSummary: () => request<FinalistSummary>("GET", "/admin/finalists/summary"),
  publishResults: () => request<PublishResult>("POST", "/admin/results/publish"),

  listAdmins: () => request<AdminUser[]>("GET", "/admin/admins"),
  addAdmin: (input: AdminInput) => request<AdminUser>("POST", "/admin/admins", input),
  removeAdmin: (email) => request<void>("DELETE", `/admin/admins/${id(email)}`),

  audit: (query = {}) => request<AuditEntry[]>("GET", `/admin/audit${queryString(query)}`),
};
