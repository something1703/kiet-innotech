/**
 * The judge and registration desk logins as a PDF: one table with each person's username, password and Grand Finale
 * panel, ready to print or send. The PDF library loads only when a PDF is made.
 */
import type { Credential } from "./admin-types";
import { downloadBlob } from "./csv";
import { formatIst } from "./format";

const INK: [number, number, number] = [41, 43, 56];
const GREY: [number, number, number] = [90, 103, 132];

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Judges on a panel first, in panel order (Panel 1, Panel 2, ... Panel 10), then the other judges, then the desk. */
function inPanelOrder(logins: Credential[]) {
  const rank = (c: Credential) => (c.kind === "desk" ? 2 : c.panels.length ? 0 : 1);
  return [...logins].sort((a, b) => rank(a) - rank(b) || natural(a.panels[0] ?? "", b.panels[0] ?? "") || natural(a.name, b.name));
}

export async function downloadLoginsPdf(logins: Credential[], signIn: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const printed = `Printed ${formatIst(new Date().toISOString())}`;
  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text("InnoTech26 · Grand Finale logins", 12, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GREY);
    doc.text(`Sign in at ${signIn}  ·  ${printed}  ·  Keep this sheet private: it holds passwords.`, 12, 19.5, { maxWidth: 272 });
    doc.setTextColor(...INK);
  };
  autoTable(doc, {
    head: [["#", "Name", "Role", "Username (email)", "Password", "Grand Finale panel"]],
    body: inPanelOrder(logins).map((c, i) => [
      String(i + 1),
      c.name,
      c.kind === "judge" ? "Judge" : "Desk",
      c.email,
      { content: c.password ?? "-", styles: { font: "courier", fontStyle: "bold", fontSize: 10.5 } },
      c.panels.join("\n") || (c.kind === "judge" ? "Not on a panel yet" : "-"),
    ]),
    startY: 25,
    margin: { top: 25, left: 12, right: 12, bottom: 14 },
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 2.2, valign: "middle", lineColor: [200, 201, 210], lineWidth: 0.2, textColor: INK },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 50 }, 2: { cellWidth: 24 }, 3: { cellWidth: 70 }, 4: { cellWidth: 52 } },
    didDrawPage: () => {
      header();
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      doc.text(`InnoTech26 logins · page ${doc.getNumberOfPages()}`, 12, doc.internal.pageSize.getHeight() - 7);
      doc.setTextColor(...INK);
    },
  });
  downloadBlob(`innotech26-logins-${new Date().toISOString().slice(0, 10)}.pdf`, doc.output("blob"));
}
