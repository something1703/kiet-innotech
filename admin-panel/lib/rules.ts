/**
 * InnoTech26 registration rules, kept in one place so the pages and the mock API agree.
 * The FastAPI backend must enforce the same rules; the frontend only uses them to guide students.
 */
import { categories, departments } from "./content";
import type { ParticipantType, Profile, ProfileInput, Team } from "./types";

export const KIET_EMAIL_DOMAIN = "kiet.edu";
export const KIET_INSTITUTION = "KIET Deemed to be University";

export const TEAM_MIN_SIZE = 2;
export const TEAM_MAX_SIZE = 5;

export const REGISTRATION_OPENS = "2026-10-03T00:00:00+05:30";
export const REGISTRATION_CLOSES = "2026-10-12T23:59:59+05:30";

/** Departments allowed two finalist teams in Categories 1 to 4. CSE(CS) is deliberately not included. */
export const DOUBLE_QUOTA_DEPARTMENTS = ["CSE", "CS", "CSE(AI)", "CSE(AIML)"];

export const participantTypeLabels: Record<ParticipantType, string> = {
  kiet: "KIET student",
  college: "Other college student",
  school: "School student",
};

export const kietCourses = ["B.Tech", "M.Tech", "MCA", "MBA", "B.Pharm", "M.Pharm", "Diploma", "Other"];
export const collegeCourses = ["B.Tech / B.E.", "M.Tech", "BCA", "MCA", "B.Sc", "M.Sc", "BBA", "MBA", "B.Pharm", "Diploma", "Other"];
export const collegeYears = [1, 2, 3, 4, 5];
export const schoolClasses = [6, 7, 8, 9, 10, 11, 12];

export function isKietEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${KIET_EMAIL_DOMAIN}`);
}

/** A @kiet.edu account can only register as KIET; any other account can only be another college or a school. */
export function allowedParticipantTypes(email: string): ParticipantType[] {
  return isKietEmail(email) ? ["kiet"] : ["college", "school"];
}

export function yearLabel(year: number, type: ParticipantType = "kiet") {
  if (type === "school") return `Class ${year}`;
  const suffix = year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th";
  return `${year}${suffix} year`;
}

// ---------- Registration window ----------

export type RegistrationState = "upcoming" | "open" | "closed";

export function registrationState(now = new Date()): RegistrationState {
  if (process.env.NEXT_PUBLIC_FORCE_REGISTRATION_OPEN === "true") return "open";
  if (now < new Date(REGISTRATION_OPENS)) return "upcoming";
  if (now > new Date(REGISTRATION_CLOSES)) return "closed";
  return "open";
}

// ---------- Institutions ----------

/** Normalises a college or school name so "K.I.E.T. Group" and "kiet group" compare equal. */
export function normaliseInstitution(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function sameInstitution(a: Pick<Profile, "participantType" | "institution">, b: Pick<Profile, "participantType" | "institution">) {
  if (a.participantType !== b.participantType) return false;
  if (a.participantType === "kiet") return true;
  return normaliseInstitution(a.institution) === normaliseInstitution(b.institution);
}

// ---------- Categories ----------

export type Eligibility = { allowed: true } | { allowed: false; reason: string };

/**
 * Whether a team can compete in a category.
 * `years` holds the year of every current member (leader included).
 */
export function categoryEligibility(categoryNumber: number, type: ParticipantType, years: number[]): Eligibility {
  const category = categories.find((c) => c.number === categoryNumber);
  if (!category) return { allowed: false, reason: "Unknown category." };
  if (type === "school" && !category.openToSchools) {
    return { allowed: false, reason: "School teams can only enter the poster categories (5 and 7)." };
  }
  if (category.firstYearOnly && years.some((year) => year !== 1)) {
    return { allowed: false, reason: "Only teams where every member is a first-year student can enter this category." };
  }
  return { allowed: true };
}

// ---------- Team checks ----------

export function openSlots(team: Pick<Team, "members" | "invitations">) {
  return TEAM_MAX_SIZE - team.members.length - team.invitations.length;
}

/** Returns why `invitee` cannot be invited to `team`, or null if they can. */
export function inviteError(team: Team, invitee: Profile | null, inviteeHasTeam: boolean): string | null {
  if (team.status !== "draft") return "This team has been submitted and can no longer be changed.";
  if (openSlots(team) <= 0) return `A team can have at most ${TEAM_MAX_SIZE} members, including pending invitations.`;
  if (!invitee) return "No registered student uses this email. Ask them to sign in and complete their profile first.";
  if (team.members.some((m) => m.userId === invitee.userId)) return "This student is already in your team.";
  if (team.invitations.some((i) => i.email === invitee.email)) return "This student has already been invited.";
  if (inviteeHasTeam) return "This student is already part of another team.";
  if (!sameInstitution(team, invitee)) return "All members must be from the same college or school as the team leader.";
  const eligibility = categoryEligibility(team.category, team.participantType, [
    ...team.members.map((m) => m.year),
    invitee.year,
  ]);
  if (!eligibility.allowed) return eligibility.reason;
  return null;
}

export type Check = { label: string; ok: boolean };

/** The checklist shown before a team is submitted. All must pass. */
export function submissionChecks(team: Team): Check[] {
  const size = team.members.length;
  const eligibility = categoryEligibility(team.category, team.participantType, team.members.map((m) => m.year));
  return [
    { label: `${TEAM_MIN_SIZE} to ${TEAM_MAX_SIZE} members have joined`, ok: size >= TEAM_MIN_SIZE && size <= TEAM_MAX_SIZE },
    { label: "No invitations are still pending", ok: team.invitations.length === 0 },
    { label: "Every member is eligible for the chosen category", ok: eligibility.allowed },
    { label: "Project title and abstract are filled in", ok: team.projectTitle.trim().length > 0 && team.abstract.trim().length > 0 },
    { label: "Registration is open", ok: registrationState() === "open" },
  ];
}

/** Number of finalist teams a KIET department can nominate in a category. */
export function finalistQuota(department: string, categoryNumber: number) {
  return DOUBLE_QUOTA_DEPARTMENTS.includes(department) && categoryNumber <= 4 ? 2 : 1;
}

// ---------- Field validation ----------

export const limits = {
  teamName: { min: 3, max: 40 },
  projectTitle: { min: 5, max: 120 },
  abstract: { min: 100, max: 1500 },
};

/** Digits only, without a leading +91 or 0 country/trunk prefix. */
export function normalisePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function validatePhone(phone: string) {
  return /^[6-9]\d{9}$/.test(normalisePhone(phone)) ? null : "Enter a 10-digit Indian mobile number.";
}

export function lengthError(label: string, value: string, { min, max }: { min: number; max: number }) {
  const length = value.trim().length;
  if (length === 0) return `${label} is required.`;
  if (length < min) return `${label} must be at least ${min} characters.`;
  if (length > max) return `${label} must be at most ${max} characters.`;
  return null;
}

/** Field errors for a profile, keyed by field. Empty when the profile is valid. */
export function profileErrors(input: ProfileInput, email: string): Partial<Record<keyof ProfileInput, string>> {
  const errors: Partial<Record<keyof ProfileInput, string>> = {};
  if (input.fullName.trim().length < 3) errors.fullName = "Enter your full name.";
  const phoneError = validatePhone(input.phone);
  if (phoneError) errors.phone = phoneError;
  if (!allowedParticipantTypes(email).includes(input.participantType)) {
    errors.participantType = isKietEmail(email)
      ? "Accounts with a @kiet.edu email register as KIET students."
      : "KIET students must sign in with their official @kiet.edu email.";
  }

  if (input.participantType === "kiet") {
    if (!input.department || !departments.includes(input.department)) errors.department = "Choose your department.";
    if (!input.course) errors.course = "Choose your course.";
    if (!collegeYears.includes(input.year)) errors.year = "Choose your year of study.";
    if (!/^\d{10,15}$/.test(input.rollNumber.trim())) errors.rollNumber = "Enter your university roll number (digits only).";
  } else {
    const label = input.participantType === "school" ? "school" : "college";
    if (input.institution.trim().length < 3) errors.institution = `Enter the full name of your ${label}.`;
    if (input.city.trim().length < 2) errors.city = "Enter the city.";
    if (input.participantType === "college") {
      if (!input.course) errors.course = "Choose your course.";
      if (!collegeYears.includes(input.year)) errors.year = "Choose your year of study.";
      if (input.rollNumber.trim().length < 3) errors.rollNumber = "Enter your college enrolment or roll number.";
    } else if (!schoolClasses.includes(input.year)) {
      errors.year = "Choose your class.";
    }
  }
  return errors;
}

// ---------- Team join codes ----------

/** No 0/O or 1/I, so codes read out loud or copied by hand stay unambiguous. */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** "k7pq 3xm9" -> "K7PQ-3XM9"; null if it cannot be a join code. */
export function normaliseJoinCode(code: string) {
  const chars = code.replace(/[\s-]/g, "").toUpperCase();
  if (chars.length !== 8 || [...chars].some((c) => !JOIN_CODE_ALPHABET.includes(c))) return null;
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}
