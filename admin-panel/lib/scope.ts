/**
 * What an organiser's role lets them see. Mirrors the server (services/admin.py): super admins see everything,
 * department admins one KIET department (COE KIET is one), outside admins other colleges and schools, startup
 * admins only startups.
 */
import type { AdminUser } from "./admin-types";
import type { ParticipantType } from "./types";

/** Outside and startup admins are limited to certain participant types rather than to a department. */
export function isTypeAdmin(admin: Pick<AdminUser, "role">) {
  return admin.role === "outside_admin" || admin.role === "startup_admin";
}

/** The participant types a type-limited admin sees; null for super and department admins. */
export function scopedTypes(admin: Pick<AdminUser, "role">): ParticipantType[] | null {
  if (admin.role === "outside_admin") return ["college", "school"];
  if (admin.role === "startup_admin") return ["startup"];
  return null;
}

/** The short name of what the admin manages, for page eyebrows. */
export function scopeName(admin: Pick<AdminUser, "role" | "department">) {
  if (admin.role === "super_admin") return "All departments, colleges, schools and startups";
  if (admin.role === "outside_admin") return "Other colleges and schools";
  if (admin.role === "startup_admin") return "Startups";
  return `${admin.department} department`;
}
