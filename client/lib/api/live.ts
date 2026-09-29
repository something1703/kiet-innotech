/**
 * Client for the FastAPI backend (NEXT_PUBLIC_API_MODE=live).
 *
 * Every request sends the Cognito ID token as `Authorization: Bearer <token>`. The server verifies it,
 * reads the email from it and enforces the rules in lib/rules.ts. JSON is snake_case on the wire and
 * camelCase here. Errors return `{ "detail": "<message for the student>" }` with a 4xx status.
 *
 * Endpoints this client expects (all under NEXT_PUBLIC_API_URL):
 *
 *   GET    /me                                  -> Me            (profile is null until onboarding)
 *   PUT    /me/profile        ProfileInput      -> Profile       (creates or updates)
 *   GET    /me/team                             -> Team | null
 *   GET    /me/invitations                      -> Invitation[]  (pending, addressed to me)
 *
 *   POST   /teams             TeamInput         -> Team          (caller becomes leader)
 *   PATCH  /teams/{id}        TeamInput         -> Team          (leader, draft only)
 *   DELETE /teams/{id}                          -> 204           (leader, draft only)
 *   POST   /teams/{id}/submit                   -> Team          (leader; locks the team)
 *   POST   /teams/{id}/leave                    -> 204           (member, draft only)
 *   DELETE /teams/{id}/members/{user_id}        -> Team          (leader, draft only)
 *   POST   /teams/{id}/invitations  { email }   -> Team          (leader)
 *   POST   /teams/join       { code }          -> Team          (join with the leader's team code)
 *   POST   /teams/{id}/join-code/reset         -> Team          (leader, draft only; old code stops working)
 *
 *   DELETE /invitations/{id}                    -> Team          (leader cancels)
 *   POST   /invitations/{id}/accept             -> 204           (invitee)
 *   POST   /invitations/{id}/decline            -> 204           (invitee)
 */
import { getIdToken } from "../auth/session";
import type { Invitation, Me, Profile, Team } from "../types";
import { ApiError, type StudentApi } from "./types";

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function convertKeys(value: Json, convert: (key: string) => string): Json {
  if (Array.isArray(value)) return value.map((item) => convertKeys(item, convert));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [convert(k), convertKeys(v, convert)]));
  }
  return value;
}

async function request<T>(method: string, path: string, body?: object): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new ApiError("Please sign in again.", 401);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(convertKeys(body as Json, toSnake)) : undefined,
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => null)) as Json;
  if (!response.ok) {
    const detail = data && typeof data === "object" && !Array.isArray(data) ? data.detail : null;
    throw new ApiError(typeof detail === "string" ? detail : "Something went wrong. Please try again.", response.status);
  }
  return convertKeys(data, toCamel) as T;
}

export const liveApi: StudentApi = {
  getMe: () => request<Me>("GET", "/me"),
  saveProfile: (input) => request<Profile>("PUT", "/me/profile", input),

  getMyTeam: () => request<Team | null>("GET", "/me/team"),
  createTeam: (input) => request<Team>("POST", "/teams", input),
  updateTeam: (teamId, input) => request<Team>("PATCH", `/teams/${teamId}`, input),
  deleteTeam: (teamId) => request<void>("DELETE", `/teams/${teamId}`),
  submitTeam: (teamId) => request<Team>("POST", `/teams/${teamId}/submit`),
  leaveTeam: (teamId) => request<void>("POST", `/teams/${teamId}/leave`),
  removeMember: (teamId, userId) => request<Team>("DELETE", `/teams/${teamId}/members/${userId}`),

  joinTeam: (code) => request<Team>("POST", "/teams/join", { code }),
  resetJoinCode: (teamId) => request<Team>("POST", `/teams/${teamId}/join-code/reset`),

  inviteMember: (teamId, email) => request<Team>("POST", `/teams/${teamId}/invitations`, { email }),
  cancelInvitation: (invitationId) => request<Team>("DELETE", `/invitations/${invitationId}`),
  getMyInvitations: () => request<Invitation[]>("GET", "/me/invitations"),
  respondToInvitation: (invitationId, accept) =>
    request<void>("POST", `/invitations/${invitationId}/${accept ? "accept" : "decline"}`),
};
