import type { AdminUser } from "../admin-types";

/**
 * Accounts offered by the development sign-in picker. Kept apart from the seed so the login page
 * does not pull the whole mock dataset into live builds.
 */
export const demoAdmins: AdminUser[] = [
  { email: "superadmin@kiet.edu", name: "Neha Verma", role: "super_admin", department: null },
  { email: "cse.coordinator@kiet.edu", name: "Amit Kumar", role: "admin", department: "CSE" },
  { email: "it.coordinator@kiet.edu", name: "Sonal Gupta", role: "admin", department: "IT" },
];
