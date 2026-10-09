/**
 * Printable attendance sheets for a judging room, a finale panel or every finale stall: one row per student,
 * grouped by team, with columns to tick presence and sign. PDF (jsPDF) or Word (.docx). The libraries load
 * only when a sheet is downloaded.
 */
import type { AttendanceSheet } from "./admin-types";
import { categoryTitle, formatIst, roundLabels } from "./format";
import { yearLabel } from "./rules";

type Row = {
  team: AttendanceSheet["teams"][number];
  member: AttendanceSheet["teams"][number]["members"][number] | null;
  first: boolean;
  span: number;
  index: number;
};

function rows(sheet: AttendanceSheet): Row[] {
  return sheet.teams.flatMap((team, index): Row[] => {
    if (team.members.length === 0) return [{ team, member: null, first: true, span: 1, index }];
    return team.members.map((member, i) => ({ team, member, first: i === 0, span: team.members.length, index }));
  });
}

const showTent = (sheet: AttendanceSheet) => sheet.round === "final";

function heading(sheet: AttendanceSheet) {
  return {
    title: "InnoTech26 · Attendance sheet",
    subtitle: `${roundLabels[sheet.round]} · ${sheet.title}`,
    details: [
      sheet.location && `Venue: ${sheet.location}`,
      sheet.jurors.length > 0 && `Judges: ${sheet.jurors.join(", ")}`,
      `${sheet.teams.length} teams · ${sheet.teams.reduce((sum, t) => sum + t.members.length, 0)} students`,
      `Printed ${formatIst(new Date().toISOString())}`,
    ].filter(Boolean) as string[],
  };
}

const memberCells = (row: Row) =>
  row.member
    ? [
        `${row.member.fullName}${row.member.role === "leader" ? " (leader)" : ""}`,
        `${yearLabel(row.member.year, row.member.course === "School" ? "school" : "college")}, ${row.member.course}`,
        row.member.department ?? row.member.institution,
        row.member.rollNumber || "—",
      ]
    : ["(no members)", "", "", ""];

const teamCell = (row: Row) => `${row.team.code}\n${row.team.name}\nCat ${row.team.category}: ${categoryTitle(row.team.category)}${row.team.status !== "submitted" ? `\n(${row.team.status})` : ""}`;

function filename(sheet: AttendanceSheet, extension: string) {
  const slug = sheet.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `innotech26-attendance-${sheet.round}-${slug || "sheet"}.${extension}`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadAttendancePdf(sheet: AttendanceSheet) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const { title, subtitle, details } = heading(sheet);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, 12, 14);
  doc.setFontSize(11);
  doc.text(subtitle, 12, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(details.join("   ·   "), 12, 27, { maxWidth: 270 });

  const head = [["#", ...(showTent(sheet) ? ["Stall"] : []), "Team", "Student", "Year, course", "Department / institution", "Roll no.", "Present", "Signature"]];
  const body = rows(sheet).map((row) => {
    const teamCells = row.first
      ? [
          { content: String(row.index + 1), rowSpan: row.span },
          ...(showTent(sheet) ? [{ content: row.team.tent ?? "—", rowSpan: row.span }] : []),
          { content: teamCell(row), rowSpan: row.span },
        ]
      : [];
    return [...teamCells, ...memberCells(row), "", ""];
  });
  autoTable(doc, {
    head,
    body,
    startY: 32,
    margin: { left: 12, right: 12, bottom: 16 },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, valign: "middle", lineColor: [190, 198, 212], lineWidth: 0.2, textColor: [11, 22, 51] },
    headStyles: { fillColor: [11, 22, 51], textColor: 255, fontStyle: "bold" },
    columnStyles: showTent(sheet)
      ? { 0: { cellWidth: 8 }, 1: { cellWidth: 14 }, 2: { cellWidth: 52 }, 7: { cellWidth: 16 }, 8: { cellWidth: 38 } }
      : { 0: { cellWidth: 8 }, 1: { cellWidth: 56 }, 6: { cellWidth: 16 }, 7: { cellWidth: 40 } },
    bodyStyles: { minCellHeight: 9 },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(90, 103, 132);
      doc.text(`${subtitle} · page ${page}`, 12, doc.internal.pageSize.getHeight() - 8);
      doc.text("Coordinator signature: ____________________", doc.internal.pageSize.getWidth() - 12, doc.internal.pageSize.getHeight() - 8, { align: "right" });
      doc.setTextColor(11, 22, 51);
    },
  });
  save(doc.output("blob"), filename(sheet, "pdf"));
}

export async function downloadAttendanceDocx(sheet: AttendanceSheet) {
  const docx = await import("docx");
  const { AlignmentType, BorderStyle, Document, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, VerticalMergeType, WidthType, ShadingType } = docx;
  const { title, subtitle, details } = heading(sheet);
  const border = { style: BorderStyle.SINGLE, size: 4, color: "BEC6D4" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const text = (value: string, bold = false, color?: string) =>
    value.split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, bold, size: 17, color })] }));
  const cell = (value: string, options: { bold?: boolean; merge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType]; width?: number; header?: boolean } = {}) =>
    new TableCell({
      children: text(value, options.bold || options.header, options.header ? "FFFFFF" : undefined),
      borders,
      verticalMerge: options.merge,
      width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
      shading: options.header ? { type: ShadingType.CLEAR, color: "auto", fill: "0B1633" } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });

  const headers = ["#", ...(showTent(sheet) ? ["Stall"] : []), "Team", "Student", "Year, course", "Department / institution", "Roll no.", "Present", "Signature"];
  const widths = showTent(sheet) ? [400, 800, 2800, 2600, 1700, 2200, 1500, 900, 2300] : [400, 3000, 2800, 1800, 2400, 1600, 900, 2300];
  const tableRows = [
    new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { header: true, width: widths[i] })) }),
    ...rows(sheet).map((row) => {
      const merge = row.span > 1 ? (row.first ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE) : undefined;
      const teamCells = [
        cell(row.first ? String(row.index + 1) : "", { merge }),
        ...(showTent(sheet) ? [cell(row.first ? (row.team.tent ?? "—") : "", { merge, bold: true })] : []),
        cell(row.first ? teamCell(row) : "", { merge }),
      ];
      return new TableRow({ cantSplit: true, children: [...teamCells, ...memberCells(row).map((value) => cell(value)), cell(""), cell("")] });
    }),
  ];

  const document = new Document({
    creator: "InnoTech26 admin panel",
    title: `${title} · ${subtitle}`,
    sections: [
      {
        properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 30 })] }),
          new Paragraph({ children: [new TextRun({ text: subtitle, bold: true, size: 22 })] }),
          new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: details.join("   ·   "), size: 17, color: "5A6784" })] }),
          new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
          new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Coordinator signature: ______________________", size: 18 })] }),
        ],
      },
    ],
  });
  save(await Packer.toBlob(document), filename(sheet, "docx"));
}
