import type { AdminStudent, AdminTeam } from "./admin-types";
import { csvFilename, downloadCsv, toCsv } from "./csv";
import { categoryTitle, resultLabels, routeLabels, statusLabels, typeShortLabels } from "./format";
import { yearLabel } from "./rules";

/** One row per member, with the team's fields repeated on each row. */
export function teamsCsv(teams: AdminTeam[]) {
  const header = [
    "Team code", "Team name", "Category", "Category title", "Domain", "Project title",
    "Participant type", "Institution", "Team department", "Route", "Status", "Result",
    "Team created", "Submitted at", "Member count", "Member role", "Member name", "Member email",
    "Member phone", "Roll number", "Member department", "Course", "Year / class", "Joined at",
  ];
  const rows = teams.flatMap((team) =>
    team.members.map((m) => [
      team.code, team.name, team.category, categoryTitle(team.category), team.domain, team.projectTitle,
      typeShortLabels[team.participantType], team.institution, team.department ?? "", routeLabels[team.route],
      statusLabels[team.status], resultLabels[team.result], team.createdAt, team.submittedAt ?? "",
      team.members.length, m.role === "leader" ? "Leader" : "Member", m.fullName, m.email, m.phone,
      m.rollNumber, m.department ?? "", m.course, yearLabel(m.year, team.participantType), m.joinedAt,
    ]),
  );
  return toCsv(header, rows);
}

export function studentsCsv(students: AdminStudent[]) {
  const header = [
    "Name", "Email", "Phone", "Participant type", "Institution", "City", "Department", "Course",
    "Year / class", "Roll number", "Team code", "Team name", "Team role", "Team status", "Registered at",
  ];
  const rows = students.map((s) => [
    s.fullName, s.email, s.phone, typeShortLabels[s.participantType], s.institution, s.city, s.department ?? "",
    s.course, yearLabel(s.year, s.participantType), s.rollNumber, s.team?.code ?? "", s.team?.name ?? "",
    s.team ? (s.team.role === "leader" ? "Leader" : "Member") : "", s.team ? statusLabels[s.team.status] : "",
    s.createdAt,
  ]);
  return toCsv(header, rows);
}

export function downloadTeams(teams: AdminTeam[]) {
  downloadCsv(csvFilename("teams"), teamsCsv(teams));
}

export function downloadStudents(students: AdminStudent[]) {
  downloadCsv(csvFilename("students"), studentsCsv(students));
}
