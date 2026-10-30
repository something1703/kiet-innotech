/**
 * Grand Finale judging sheets to print: for each panel, one landscape A4 sheet per rubric (a panel can hold teams of
 * several categories), every team a row with boxes for each of the nine marks, the total out of 50 and remarks, and a
 * place for the judge's name and signature. Teams on no panel get a sheet of their own. The PDF library loads only when a
 * sheet is made.
 */
import type { Finale, JudgePanel, Panel } from "./admin-types";
import { categories, rubrics } from "./content";
import { downloadBlob } from "./csv";
import { formatIst } from "./format";

const INK: [number, number, number] = [41, 43, 56];
const GREY: [number, number, number] = [90, 103, 132];
const LINE: [number, number, number] = [150, 152, 165];
const HEAD: [number, number, number] = [228, 230, 238];
// A4 landscape, in mm, and the margins: the columns below add up to exactly the width in between.
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 8;
// The mark columns are wide enough for the parameters' names to wrap between words, not inside them.
const WIDTHS = { n: 6, stall: 19, team: 32, project: 30, cat: 7, part: 16, query: 16, total: 12 };
const REMARKS = PAGE_W - 2 * MARGIN - (WIDTHS.n + WIDTHS.stall + WIDTHS.team + WIDTHS.project + WIDTHS.cat + 8 * WIDTHS.part + WIDTHS.query + WIDTHS.total);

/** The standard PDF fonts have no glyphs beyond Western European: other letters are written without accents, or as "?". */
function pdfText(value: string) {
  return value
    .replace(/[‐‑‒]/g, "-")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF\n–—‘’“”•…·]/g, "?");
}

type Row = { stall: string; place: string; name: string; code: string; project: string; category: number; who: string };
type Sheet = { label: string; judges: string; rows: Row[] };

const placeOf = (building: string, room: string) => [building, /^\d/.test(room) ? `Room ${room}` : room].filter(Boolean).join(" · ");
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** One panel's (or the no-panel teams') rows, by rubric, in stall order. */
function byRubric(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of [...rows].sort((a, b) => natural(a.stall || "~", b.stall || "~") || natural(a.code, b.code))) {
    const key = categories.find((c) => c.number === row.category)?.rubric ?? "software";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()];
}

/** Super admins: every Grand Finale panel (or one, or the teams on no panel), with each team's stall and place. */
export async function downloadJudgingSheets(panels: Panel[], finale: Finale, only: string | "all" | "none" = "all") {
  const info = new Map(finale.teams.map((t) => [t.team.id, t]));

  // Each sheet: the panel's label, its judges, and its teams.
  const sheets: Sheet[] = [];
  const toRow = (id: string, fallback: { name: string; code: string; projectTitle: string; category: number; institution: string; department: string | null; participantType: string }, tent: string | null): Row => {
    const t = info.get(id);
    const team = t?.team ?? fallback;
    return {
      stall: t?.octonorm ?? tent ?? "",
      place: t ? placeOf(t.building, t.room) : "",
      name: team.name,
      code: team.code,
      project: team.projectTitle,
      category: team.category,
      who: team.participantType === "kiet" ? `KIET ${t?.club || team.department || ""}`.trim() : team.institution,
    };
  };
  for (const panel of [...panels].sort((a, b) => natural(a.name, b.name))) {
    if (only !== "all" && only !== panel.id) continue;
    sheets.push({
      label: [panel.building, panel.name].filter(Boolean).join(" · "),
      judges: panel.jurors.map((j) => j.name).join(", "),
      rows: panel.teams.map((t) => toRow(t.id, t, t.tent)),
    });
  }
  if (only === "all" || only === "none") {
    const loose = finale.teams.filter((t) => !t.panelId);
    if (loose.length) sheets.push({ label: "Teams on no panel (any judge may score them)", judges: "", rows: loose.map((t) => toRow(t.team.id, t.team, t.octonorm)) });
  }

  const name = only === "all" ? "all-panels" : only === "none" ? "no-panel" : (panels.find((p) => p.id === only)?.name ?? "panel");
  await makePdf(sheets, name);
}

/** A judge: their own Grand Finale panel, to judge on paper. */
export async function downloadMyJudgingSheet(panel: JudgePanel, judgeName: string) {
  const rows = panel.teams.map((t) => ({
    stall: t.tent ?? "",
    place: t.place,
    name: t.name,
    code: t.code,
    project: t.projectTitle,
    category: t.category,
    who: t.participantType === "kiet" ? `KIET ${t.club || t.department || ""}`.trim() : t.institution,
  }));
  await makePdf([{ label: [panel.building, panel.name].filter(Boolean).join(" · "), judges: judgeName, rows }], panel.name);
}

async function makePdf(sheets: Sheet[], name: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const printed = formatIst(new Date().toISOString());
  let first = true;
  for (const sheet of sheets) {
    for (const [key, rows] of byRubric(sheet.rows)) {
      const rubric = rubrics[key as keyof typeof rubrics];
      if (!first) doc.addPage();
      first = false;
      const header = () => {
        doc.setTextColor(...INK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("InnoTech26 Grand Finale · Judging sheet", MARGIN, 11);
        doc.setFontSize(10.5);
        doc.text(pdfText(sheet.label), MARGIN, 17, { maxWidth: 190 });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...GREY);
        doc.text(pdfText(`Rubric: ${rubric.label} (${rubric.appliesTo})  ·  ${rows.length} ${rows.length === 1 ? "team" : "teams"}`), MARGIN, 22);
        doc.text(pdfText(`Judge: ${sheet.judges || "________________________________"}`), PAGE_W - MARGIN, 11, { align: "right", maxWidth: 85 });
        doc.text("30 October 2026  ·  G Block, KIET", PAGE_W - MARGIN, 17, { align: "right" });
        doc.text("Each part 0 to 5 · Query Addressing 0 to 10 · Total out of 50", PAGE_W - MARGIN, 22, { align: "right" });
        doc.setTextColor(...INK);
      };
      const criteria = rubric.criteria;
      const head = [
        [
          { content: "#", rowSpan: 2 },
          { content: "Stall · place", rowSpan: 2 },
          { content: "Team", rowSpan: 2 },
          { content: "Project", rowSpan: 2 },
          { content: "Cat", rowSpan: 2 },
          ...criteria.slice(0, 4).map((c) => ({ content: pdfText(c.title), colSpan: 2 })),
          { content: pdfText(criteria[4].title), rowSpan: 1 },
          { content: "Total\n/ 50", rowSpan: 2 },
          { content: "Remarks", rowSpan: 2 },
        ],
        [...criteria.slice(0, 4).flatMap((c) => (c.parts ?? ["", ""]).map((p) => `${pdfText(p)}\n/ 5`)), `${pdfText(criteria[4].parts?.[0] ?? "")}\n/ 10`],
      ];
      const body = rows.map((r, i) => [
        String(i + 1),
        // The venue is in the sheet's title when the whole panel is there; the place then starts at the floor.
        pdfText(`${r.stall || "-"}${r.place ? `\n${r.place.replace(/^G Block · /, "").replace("Corridor, ", "")}` : ""}`),
        pdfText(`${r.name}\n${r.code}${r.who ? `\n${r.who}` : ""}`),
        // Long titles are cut: the team's name and code say which team it is, and the row stays short enough to write in.
        pdfText(r.project.length > 72 ? `${r.project.slice(0, 70).trimEnd()}…` : r.project),
        String(r.category),
        ...Array.from({ length: 9 }, () => ""),
        "",
        "",
      ]);
      autoTable(doc, {
        head,
        body,
        startY: 26,
        margin: { top: 26, left: MARGIN, right: MARGIN, bottom: 12 },
        theme: "grid",
        showHead: "everyPage",
        rowPageBreak: "avoid",
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1, valign: "middle", lineColor: LINE, lineWidth: 0.2, textColor: INK, overflow: "linebreak" },
        headStyles: { fillColor: HEAD, textColor: INK, fontStyle: "bold", fontSize: 6.4, halign: "center", valign: "middle", lineColor: LINE, lineWidth: 0.2, cellPadding: 1 },
        bodyStyles: { minCellHeight: 11 },
        columnStyles: {
          0: { cellWidth: WIDTHS.n, halign: "center" },
          1: { cellWidth: WIDTHS.stall, fontStyle: "bold", fontSize: 7 },
          2: { cellWidth: WIDTHS.team, fontSize: 7.5 },
          3: { cellWidth: WIDTHS.project, fontSize: 7 },
          4: { cellWidth: WIDTHS.cat, halign: "center" },
          ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [5 + i, { cellWidth: WIDTHS.part }])),
          13: { cellWidth: WIDTHS.query },
          14: { cellWidth: WIDTHS.total },
          15: { cellWidth: REMARKS },
        },
        didParseCell: (data) => {
          // Mark boxes stay empty and roomy; the team's name stands out.
          if (data.section === "body" && data.column.index === 2) data.cell.styles.fontStyle = "normal";
        },
        didDrawPage: () => {
          header();
          doc.setFontSize(7);
          doc.setTextColor(...GREY);
          doc.text(pdfText(`${sheet.label}  ·  printed ${printed}`), MARGIN, PAGE_H - 5, { maxWidth: 220 });
          doc.text(`Page ${doc.getNumberOfPages()}`, PAGE_W - MARGIN, PAGE_H - 5, { align: "right" });
          doc.setTextColor(...INK);
        },
      });
      // The judge signs under the last row of the sheet (on a new page when there is no room left).
      const end = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
      let y = end + 9;
      if (y + 8 > PAGE_H - 12) {
        doc.addPage();
        header();
        y = 34;
      }
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...INK);
      doc.text("Judge's name: ______________________________", MARGIN, y);
      doc.text("Signature: _________________________", MARGIN + 105, y);
      doc.text("Time: ____________", MARGIN + 190, y);
    }
  }
  if (sheets.length === 0) {
    doc.setFontSize(12);
    doc.text("No Grand Finale panel has teams yet.", MARGIN, 20);
  }
  downloadBlob(`innotech26-judging-sheets-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`, doc.output("blob"));
}
