"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Printer, Utensils } from "lucide-react";
import { api } from "@/lib/api";
import type { DeskTeam } from "@/lib/admin-types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useQuery } from "@/lib/use-query";
import { Loading, Notice } from "@/components/ui/Notice";

/** One printed lunch coupon: a student's (named) or a guest's (blank name line). */
type Coupon = { serial: string; name: string | null; team: string | null; code: string | null; stall: string | null; from: string | null };

function couponsOf(teams: DeskTeam[], onlyCheckedIn: boolean): Coupon[] {
  return teams.flatMap((team) =>
    team.members
      .filter((m) => !m.banned && (!onlyCheckedIn || m.checkedInAt))
      .map((m, i) => ({
        serial: `${team.code}-${i + 1}`,
        name: m.fullName,
        team: team.name,
        code: team.code,
        stall: team.tent,
        from: team.participantType === "kiet" ? `KIET${team.department ? ` · ${team.department}` : ""}` : team.institution,
      })),
  );
}

/**
 * Printable lunch coupons for the Grand Finale: one per person, eight to an A4 page, each with a tear-off stub for the
 * food counter. `?team=IT26-0217` prints one team's; without it, every finale team's in stall order. Guest coupons (for
 * judges, volunteers and start-ups) have a blank name line. Giving a coupon is still marked at the event desk.
 */
export function CouponSheet() {
  const { state } = useAuth();
  const params = useSearchParams();
  const code = (params.get("team") ?? "").trim().toUpperCase();
  const [guests, setGuests] = useState(0);
  const [onlyCheckedIn, setOnlyCheckedIn] = useState(false);
  const allowed = state.status === "signed_in" && (state.admin.role === "super_admin" || state.admin.role === "desk");
  const teams = useQuery(allowed ? `coupons:${code}` : null, async () =>
    code ? (await api.deskSearch(code)).filter((t) => t.code === code) : api.deskExport(),
  );

  if (state.status === "loading") return <Loading label="Checking your session" />;
  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Notice tone="info" title="Sign in first">
          Lunch coupons are printed by super admins and event desk volunteers. <Link href="/login?next=/coupons/" className="font-semibold underline">Sign in</Link>
        </Notice>
      </div>
    );
  }

  const coupons = [
    ...couponsOf(teams.data ?? [], onlyCheckedIn),
    ...Array.from({ length: guests }, (_, i) => ({ serial: `GUEST-${String(i + 1).padStart(3, "0")}`, name: null, team: null, code: null, stall: null, from: null })),
  ];

  return (
    <div className="coupon-root min-h-screen bg-surface print:bg-white">
      <style>{PRINT_CSS}</style>
      <div className="no-print sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-navy-900">Lunch coupons{code ? ` · ${code}` : " · every finale team"}</p>
            <p className="text-xs text-muted">
              {coupons.length} coupons, 8 per A4 page. Print in colour (turn on “Background graphics”). One coupon for one person; mark it given at the Event desk.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-navy-800">
            <input type="checkbox" className="size-4 accent-navy-900" checked={onlyCheckedIn} onChange={(e) => setOnlyCheckedIn(e.target.checked)} />
            Only students checked in
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-navy-800">
            Guest coupons
            <input
              type="number"
              min={0}
              max={200}
              value={guests}
              onChange={(e) => setGuests(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
              className="h-8 w-20 rounded-lg px-2 text-sm ring-1 ring-line"
            />
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={coupons.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
          >
            <Printer aria-hidden="true" className="size-4" />
            Print
          </button>
        </div>
        {teams.error && <div className="mx-auto mt-2 max-w-5xl"><Notice tone="error">{teams.error}</Notice></div>}
      </div>

      {!teams.data && !teams.error ? (
        <Loading label="Loading coupons" />
      ) : coupons.length === 0 ? (
        <p className="no-print mx-auto max-w-5xl px-4 py-10 text-sm text-muted">{code ? `No Grand Finale team ${code}.` : "No coupons to print."}</p>
      ) : (
        <div className="coupon-grid mx-auto max-w-5xl px-4 py-6">
          {coupons.map((c) => (
            <CouponCard key={c.serial} coupon={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CouponCard({ coupon }: { coupon: Coupon }) {
  return (
    <article className="coupon">
      <div className="coupon-main">
        <div className="coupon-glow" aria-hidden="true" />
        <header className="flex items-center gap-2">
          <Image src="/images/brand/innotech-emblem.png" alt="" width={219} height={219} className="size-8 rounded-full bg-white p-0.5" />
          <div className="leading-none">
            <p className="font-display text-[15px] font-bold text-white">
              InnoTech<span className="text-brand-400">26</span>
            </p>
            <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-white/60">Grand Finale · 30 Oct 2026</p>
          </div>
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-brand-300 ring-1 ring-white/15">
            Admit one
          </span>
        </header>

        <div className="mt-auto flex items-end gap-2.5 pt-2">
          <span className="coupon-plate" aria-hidden="true">
            <Utensils className="size-6" />
          </span>
          <div>
            <p className="font-display text-[38px] font-black leading-[0.85] tracking-tight text-white">LUNCH</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-brand-300">Food coupon · one meal</p>
          </div>
        </div>

        <div className="mt-auto rounded-lg bg-white/[0.07] px-2.5 py-1.5 ring-1 ring-white/10">
          {coupon.name ? (
            <>
              <p className="truncate text-[12px] font-bold text-white">{coupon.name}</p>
              <p className="truncate text-[9px] text-white/65">
                {coupon.team} · {coupon.code}
              </p>
              {coupon.from && <p className="truncate text-[8.5px] text-white/45">{coupon.from}</p>}
            </>
          ) : (
            <>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55">Guest · judge · volunteer</p>
              <p className="mt-2 border-b border-dashed border-white/40 text-[9px] text-white/40">Name</p>
            </>
          )}
        </div>
        <p className="mt-1.5 text-[7.5px] leading-snug text-white/50">Valid once, on 30 October at the InnoTech26 food counter. Not transferable. Hand the stub to the counter.</p>
      </div>

      <div className="coupon-stub">
        <p className="text-[7px] font-bold uppercase tracking-[0.22em] text-navy-700">Stall</p>
        <p className="font-display text-[26px] font-black leading-none text-navy-900">{coupon.stall ?? "—"}</p>
        <div className="my-2 h-px w-10 bg-navy-900/20" />
        <p className="vertical font-display text-[13px] font-black uppercase tracking-[0.3em] text-brand-600">Lunch</p>
        <p className="mt-auto break-all text-center font-mono text-[7.5px] font-semibold text-navy-800">{coupon.serial}</p>
      </div>
    </article>
  );
}

const PRINT_CSS = `
.coupon-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.coupon { position: relative; display: flex; height: 64mm; overflow: hidden; border-radius: 14px; break-inside: avoid;
  box-shadow: 0 1px 2px rgb(0 0 0 / .08), 0 8px 24px -12px rgb(28 29 38 / .45);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.coupon-main { position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0; padding: 10px 12px; overflow: hidden;
  background: radial-gradient(120% 90% at 100% 0%, #e85524 0%, rgba(232,85,36,.35) 28%, transparent 55%),
              radial-gradient(90% 70% at 0% 100%, rgba(247,160,122,.35) 0%, transparent 60%),
              linear-gradient(135deg, #1c1d26 0%, #292b38 55%, #363948 100%); }
.coupon-glow { position: absolute; inset: auto -30px -40px auto; width: 120px; height: 120px; border-radius: 9999px;
  background: repeating-conic-gradient(from 0deg, rgba(255,255,255,.07) 0 10deg, transparent 10deg 20deg); }
.coupon-plate { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 9999px;
  color: #1c1d26; background: linear-gradient(135deg, #ffe3d4, #f7a07a); box-shadow: 0 0 0 3px rgba(255,255,255,.15); }
.coupon-stub { position: relative; display: flex; width: 22mm; flex-direction: column; align-items: center; padding: 10px 6px 8px;
  background: linear-gradient(180deg, #fff4ee 0%, #ffe3d4 100%); border-left: 2px dashed rgba(41,43,56,.35); }
.coupon-stub::before, .coupon-stub::after { content: ""; position: absolute; left: -9px; width: 16px; height: 16px; border-radius: 9999px; background: #f6f6f9; }
.coupon-stub::before { top: -8px; } .coupon-stub::after { bottom: -8px; }
.vertical { writing-mode: vertical-rl; transform: rotate(180deg); }
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  .no-print { display: none !important; }
  .coupon-root { background: #fff !important; }
  .coupon-grid { max-width: none; padding: 0; gap: 4mm; }
  .coupon { box-shadow: none; outline: 0.3mm solid #c9cad3; }
  .coupon-stub::before, .coupon-stub::after { background: #fff; }
  .coupon:nth-child(8n) { break-after: page; }
}
`;
