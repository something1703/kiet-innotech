"use client";

import { useState } from "react";
import { FileDown, FileText } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { JudgingRound } from "@/lib/admin-types";
import { Button } from "@/components/ui/Button";

/** Downloads a room's (or every finale stall's) attendance sheet as a PDF or a Word document. */
export function AttendanceButtons({ round, panelId, label }: { round: JudgingRound; panelId?: string; label: string }) {
  const [pending, setPending] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(format: "pdf" | "docx") {
    setPending(format);
    setError(null);
    try {
      const [sheet, attendance] = await Promise.all([api.attendance(round, panelId), import("@/lib/attendance")]);
      if (format === "pdf") await attendance.downloadAttendancePdf(sheet);
      else await attendance.downloadAttendanceDocx(sheet);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div role="group" aria-label={`Attendance sheet for ${label}`} className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => download("pdf")} pending={pending === "pdf"} disabled={pending !== null}>
          {pending !== "pdf" && <FileDown aria-hidden="true" className="size-3.5" />}
          Attendance PDF
        </Button>
        <Button size="sm" variant="secondary" onClick={() => download("docx")} pending={pending === "docx"} disabled={pending !== null}>
          {pending !== "docx" && <FileText aria-hidden="true" className="size-3.5" />}
          Word
        </Button>
      </div>
      {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
