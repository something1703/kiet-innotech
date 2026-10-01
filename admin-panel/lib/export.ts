import type { AdminStudent, AdminTeam } from "./admin-types";
import { asText, csvFilename, downloadCsv, toCsv } from "./csv";
import { categoryTitle, formatCsvDateTime, resultLabels, routeLabels, statusLabels, typeShortLabels } from "./format";
import { yearLabel } from "./rules";

/**
 * One row per member, with the team's fields repeated on each row. A team with no members (its
 * leader deleted their account, say) still gets one row, with the member columns blank.
 * Times are in IST.
 */
export function teamsCsv(teams: AdminTeam[]) {
  const header = [
    "Team code", "Team name", "Category", "Category title", "Domain", "Project title",
    "Participant type", "Institution", "Team department", "Route", "Status", "Result",
    "Team created (IST)", "Submitted at (IST)", "Member count", "Member role", "Member name", "Member email",
    "Member phone", "Roll number", "Member department", "Course", "Year / class", "Joined at (IST)",
  ];
  const rows = teams.flatMap((team) => {
    const teamCells = [
      team.code, team.name, team.category, categoryTitle(team.category), team.domain, team.projectTitle,
      typeShortLabels[team.participantType], team.institution, team.department ?? "", routeLabels[team.route],
      statusLabels[team.status], resultLabels[team.result], formatCsvDateTime(team.createdAt), formatCsvDateTime(team.submittedAt),
      team.members.length,
    ];
    if (team.members.length === 0) return [[...teamCells, "", "", "", "", "", "", "", "", ""]];
    return team.members.map((m) => [
      ...teamCells,
      m.role === "leader" ? "Leader" : "Member", m.fullName, m.email, asText(m.phone),
      asText(m.rollNumber), m.department ?? "", m.course, yearLabel(m.year, team.participantType), formatCsvDateTime(m.joinedAt),
    ]);
  });
  return toCsv(header, rows);
}

export function studentsCsv(students: AdminStudent[]) {
  const header = [
    "Name", "Email", "Phone", "Participant type", "Institution", "City", "Department", "Course",
    "Year / class", "Roll number", "Team code", "Team name", "Team role", "Team status", "Registered at (IST)",
  ];
  const rows = students.map((s) => [
    s.fullName, s.email, asText(s.phone), typeShortLabels[s.participantType], s.institution, s.city, s.department ?? "",
    s.course, yearLabel(s.year, s.participantType), asText(s.rollNumber), s.team?.code ?? "", s.team?.name ?? "",
    s.team ? (s.team.role === "leader" ? "Leader" : "Member") : "", s.team ? statusLabels[s.team.status] : "",
    formatCsvDateTime(s.createdAt),
  ]);
  return toCsv(header, rows);
}

export function downloadTeams(teams: AdminTeam[]) {
  downloadCsv(csvFilename("teams"), teamsCsv(teams));
}

export function downloadStudents(students: AdminStudent[]) {
  downloadCsv(csvFilename("students"), studentsCsv(students));
}
