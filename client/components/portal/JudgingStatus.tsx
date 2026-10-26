"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Award, Ban, CalendarClock, CircleCheck, CircleHelp, CircleX, Clock, Download, Frown, Hourglass, MapPin, PartyPopper, Play, QrCode, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { certificateFileNames } from "@/lib/certificate-defaults";
import { saveCertificate } from "@/lib/certificate-download";
import { categories } from "@/lib/content";
import { attendanceEnabled } from "@/lib/features";
import type { EventPass, ResultCard } from "@/lib/types";
import { usePortal } from "./PortalProvider";
import { ResultReveal, type RevealResult } from "./ResultReveal";

const day = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const looks: Record<ResultCard["status"], { box: string; Icon: typeof Trophy }> = {
  winner: { box: "bg-gradient-to-br from-amber-400 to-accent-500 text-white ring-amber-300", Icon: Trophy },
  finalist: { box: "bg-emerald-600 text-white ring-emerald-500", Icon: PartyPopper },
  awaiting: { box: "bg-white text-ink ring-line", Icon: Clock },
  not_selected: { box: "bg-white text-ink ring-line", Icon: Frown },
  participated: { box: "bg-white text-ink ring-line", Icon: Frown },
  qualified: { box: "bg-emerald-600 text-white ring-emerald-500", Icon: PartyPopper },
  disqualified: { box: "bg-red-50 text-red-900 ring-red-200", Icon: Ban },
  rejected: { box: "bg-red-50 text-red-900 ring-red-200", Icon: CircleX },
};

/**
 * Where the student is judged (room, building and time, or the finale stall) and the team's results as they are
 * announced: awaiting, finalist or qualified, better luck next time, disqualified, or a prize with its amount.
 */
export function JudgingStatus({ showPassLink = true }: { showPassLink?: boolean }) {
  const { me, team } = usePortal();
  const [pass, setPass] = useState<EventPass | null>(null);
  const [results, setResults] = useState<ResultCard[]>([]);
  const [manual, setManual] = useState<RevealResult | null>(null);
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The department result as a moment: a winner always, a student who was present when their certificate is ready.
  const resultCard = results.find((c) => c.round === "department" && (c.status === "winner" || (c.status === "participated" && c.certificate)));
  const revealFor = (card: ResultCard): RevealResult | null => {
    if (!me.profile || !team) return null;
    return {
      kind: card.status === "winner" ? (card.place === 1 ? "first" : "second") : "participation",
      studentName: me.profile.fullName,
      teamName: team.name,
      teamCode: team.code,
      department: team.department ?? me.profile.department ?? "",
      category: team.category,
      categoryTitle: categories.find((c) => c.number === team.category)?.title ?? "",
      amount: card.amount,
    };
  };
  // The first time a student opens the page after their result is out, it plays by itself; "Watch your result" plays it again.
  const seenKey = resultCard ? `innotech-reveal:${me.email.toLowerCase()}:${resultCard.status}:${resultCard.place ?? 0}` : null;
  const auto = resultCard && seenKey && closedKey !== seenKey && !wasSeen(seenKey) ? revealFor(resultCard) : null;
  const reveal = manual ?? auto;
  function closeReveal() {
    if (seenKey) {
      markSeen(seenKey);
      setClosedKey(seenKey);
    }
    setManual(null);
  }

  async function download(card: ResultCard) {
    if (!card.certificate) return;
    setSaving(true);
    setSaveError(null);
    try {
      saveCertificate(await api.downloadCertificate(card.certificate), certificateFileNames[card.certificate]);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not download the certificate.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    api.getMyPass().then((p) => !cancelled && setPass(p), () => undefined);
    api.getMyResults().then((r) => !cancelled && setResults(r.cards), () => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const rounds = pass?.rounds ?? [];
  if (rounds.length === 0 && results.length === 0) return null;

  return (
    <div className="space-y-4">
      {reveal && resultCard && (
        <ResultReveal
          result={reveal}
          onClose={closeReveal}
          onDownload={resultCard.certificate ? () => download(resultCard) : undefined}
          downloadNote="Certificates are given to students who were marked present at the department round."
        />
      )}
      {results.map((card) => {
        const looked = looks[card.status];
        const box = looked.box;
        const Icon = card.status === "participated" && card.round === "department" ? Award : looked.Icon;
        const celebrate = card.round === "department" && (card.status === "winner" || (card.status === "participated" && card.certificate));
        const bright = card.status === "winner" || card.status === "finalist" || card.status === "qualified";
        return (
          <section key={`${card.round}-${card.status}`} aria-label={card.title} className={`flex items-start gap-4 rounded-3xl p-5 ring-1 sm:p-6 ${box}`}>
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${bright ? "bg-white/20" : "bg-surface text-accent-500"}`}>
              <Icon size={24} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-bold uppercase tracking-[0.18em] ${bright ? "text-white/80" : "text-accent-500"}`}>
                {card.round === "final" ? "Grand Finale" : "Department round"}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold">{card.title}</h2>
              {card.amount !== null && <p className="mt-1 font-display text-3xl font-bold">₹{card.amount.toLocaleString("en-IN")}</p>}
              <p className={`mt-1 text-sm ${bright ? "text-white/90" : card.status === "disqualified" || card.status === "rejected" ? "text-red-800" : "text-muted"}`}>{card.message}</p>
              {celebrate && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.certificate && (
                    <button
                      type="button"
                      onClick={() => void download(card)}
                      disabled={saving}
                      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:opacity-60 ${bright ? "bg-white text-navy-900 hover:bg-brand-50" : "bg-accent-500 text-white hover:bg-accent-600"}`}
                    >
                      <Download size={16} aria-hidden="true" />
                      {saving ? "Preparing…" : "Download certificate"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setManual(revealFor(card))}
                    className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition ${bright ? "text-white ring-white/40 hover:bg-white/10" : "text-ink ring-line hover:bg-surface"}`}
                  >
                    <Play size={14} aria-hidden="true" />
                    Watch your result
                  </button>
                </div>
              )}
              {celebrate && saveError && <p className={`mt-2 text-sm ${bright ? "text-white" : "text-red-700"}`}>{saveError}</p>}
              {card.round === "department" && card.status === "winner" && !card.certificate && (
                <p className="mt-3 text-xs text-white/85">The certificate is for team members who were marked present at the department round.</p>
              )}
            </div>
          </section>
        );
      })}

      {rounds.map((round) => (
        <section key={round.round} className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-500">{round.round === "final" ? "Grand Finale" : "Your room"}</p>
            {round.round === "department" && round.room && round.attendance && <AttendanceBadge attendance={round.attendance} />}
          </div>
          {round.round === "department" ? (
            round.room ? (
              <div className="mt-2 space-y-2">
                <p className="flex items-start gap-2.5">
                  <MapPin size={20} className="mt-0.5 shrink-0 text-accent-500" aria-hidden="true" />
                  <span>
                    <span className="block font-display text-2xl font-bold text-ink">
                      {round.building ? `${round.building} · ` : ""}Room {round.room}
                    </span>
                    {round.location && <span className="block text-sm text-muted">{round.location}</span>}
                  </span>
                </p>
                {round.slotStart && round.slotEnd && (
                  <p className="flex items-center gap-2.5 text-sm font-semibold text-ink">
                    <CalendarClock size={20} className="shrink-0 text-accent-500" aria-hidden="true" />
                    {day.format(new Date(round.slotStart))} · {time.format(new Date(round.slotStart))} – {time.format(new Date(round.slotEnd))}
                  </p>
                )}
                <p className="text-sm text-muted">Be there 15 minutes early with your whole team and your college ID cards.</p>
                {round.attendance && <AttendanceLine attendance={round.attendance} presentAt={round.presentAt} />}
              </div>
            ) : (
              <div className="mt-2 flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
                  <Hourglass size={24} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold text-ink">Your room will be allotted soon</p>
                  <p className="mt-1 text-sm text-muted">
                    Your department will allot your room and time slot before the department round. Come back to this page: it appears here
                    as soon as it is ready.
                  </p>
                  {round.plannedStart && round.plannedEnd && (
                    <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-ink">
                      <CalendarClock size={18} className="shrink-0 text-accent-500" aria-hidden="true" />
                      Your department is judged {day.format(new Date(round.plannedStart))} · {time.format(new Date(round.plannedStart))} –{" "}
                      {time.format(new Date(round.plannedEnd))}
                    </p>
                  )}
                </div>
              </div>
            )
          ) : (
            <p className="mt-2 text-sm text-muted">
              {round.tent ? (
                <>
                  Your stall: <span className="font-display text-2xl font-bold text-ink">{round.tent}</span>
                </>
              ) : (
                "No stall has been allotted yet. Your stall number appears here once the organisers allot it, before the Grand Finale on 30 October."
              )}
            </p>
          )}
          {showPassLink && attendanceEnabled && (
            <Link href="/pass" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent-600 hover:underline">
              <QrCode size={16} aria-hidden="true" />
              Open my event pass
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </section>
      ))}
    </div>
  );
}

/** Whether this result has already played for this student on this device. Without storage it counts as seen: no replay on every visit. */
function wasSeen(key: string) {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return true;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // nothing to remember it with
  }
}

/** The same state as the line below, as a badge you can see at a glance. */
function AttendanceBadge({ attendance }: { attendance: "present" | "absent" | "not_marked" }) {
  const look = {
    present: ["Present", "bg-emerald-50 text-emerald-800 ring-emerald-200"],
    absent: ["Absent", "bg-red-50 text-red-800 ring-red-200"],
    not_marked: ["Not marked yet", "bg-surface text-muted ring-line"],
  }[attendance];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${look[1]}`}>{look[0]}</span>;
}

/** Whether the judges marked this student present or absent in their room, or have not marked them yet. */
function AttendanceLine({ attendance, presentAt }: { attendance: "present" | "absent" | "not_marked"; presentAt: string | null }) {
  if (attendance === "present") {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
        <CircleCheck size={18} className="shrink-0" aria-hidden="true" />
        Attendance: present{presentAt ? ` (marked at ${time.format(new Date(presentAt))})` : ""}
      </p>
    );
  }
  if (attendance === "absent") {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
        <CircleX size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Attendance: absent.
          <span className="block font-normal">If this is a mistake, tell your department coordinator or the judges in your room.</span>
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-ink">
      <CircleHelp size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      <span>
        Attendance: not marked yet
        <span className="block font-normal text-muted">You are marked present once the organisers or the judges mark you in your room, so be there on time.</span>
      </span>
    </p>
  );
}
