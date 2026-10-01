import { API_MODE } from "./auth/session";

/**
 * Team pages live at /teams/view/?id=<id> rather than /teams/<id>: the panel is a static export,
 * and team IDs are not known at build time.
 */
export function teamHref(id: string) {
  return `/teams/view/?id=${encodeURIComponent(id)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether an ID from the URL could be a team: a UUID on the real backend, any short token in the mock ("team-001"). */
export function isTeamId(id: string | null): id is string {
  if (!id) return false;
  return API_MODE === "live" ? UUID.test(id) : /^[\w-]{1,64}$/.test(id);
}
