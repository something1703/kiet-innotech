"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, RefreshCw, Star } from "lucide-react";
import { api } from "@/lib/api";
import type { FeedbackItem } from "@/lib/admin-types";
import { downloadWorkbook, sheet } from "@/lib/excel";
import { formatDateTime, plural } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";

const ROLE_LABELS: Record<FeedbackItem["role"], string> = {
  student: "Participant",
  judge: "Judge",
  faculty: "Faculty / volunteer",
  parent: "Parent",
  guest: "Visitor",
  other: "Other",
};

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true" className={`size-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-line"}`} />
      ))}
    </span>
  );
}

/** Super admins: what people wrote in the thank-you letter's feedback form, with who sent it. */
export function FeedbackView() {
  const list = useQuery("feedback", () => api.feedback());
  const [q, setQ] = useState("");
  const [rating, setRating] = useState("");
  const [role, setRole] = useState("");
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const query = q.trim().toLowerCase();
  const shown = items.filter(
    (f) =>
      (!rating || f.rating === Number(rating)) &&
      (!role || f.role === role) &&
      (!query || [f.name, f.email, f.phone, f.institution, f.teamCode, f.teamName, f.liked, f.improve].some((v) => v.toLowerCase().includes(query))),
  );
  const total = items.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="After the event"
        title="Feedback"
        description="What students, judges and visitors wrote in the thank-you letter on the home page, newest first, with who sent it. A signed-in student's details come from their account."
        actions={
          <>
            <Button variant="secondary" onClick={list.reload} pending={list.loading && !!list.data}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Refresh
            </Button>
            <Button
              variant="secondary"
              disabled={shown.length === 0}
              onClick={() =>
                downloadWorkbook("feedback", [
                  sheet(
                    "Feedback",
                    [
                      { header: "Received", width: 20, value: (f: FeedbackItem) => formatDateTime(f.createdAt) },
                      { header: "Rating", width: 8, value: (f: FeedbackItem) => f.rating },
                      { header: "Name", width: 26, value: (f: FeedbackItem) => f.name },
                      { header: "Email", width: 32, value: (f: FeedbackItem) => f.email, text: true },
                      { header: "Phone", width: 14, value: (f: FeedbackItem) => f.phone, text: true },
                      { header: "Role", width: 16, value: (f: FeedbackItem) => ROLE_LABELS[f.role] },
                      { header: "College / department", width: 30, value: (f: FeedbackItem) => f.institution },
                      { header: "Team", width: 26, value: (f: FeedbackItem) => (f.teamCode ? `${f.teamCode} ${f.teamName}` : "") },
                      { header: "Signed in", width: 10, value: (f: FeedbackItem) => (f.signedIn ? "Yes" : "No") },
                      { header: "What they enjoyed", width: 60, value: (f: FeedbackItem) => f.liked },
                      { header: "What could be better", width: 60, value: (f: FeedbackItem) => f.improve },
                    ],
                    shown,
                  ),
                ])
              }
            >
              <FileSpreadsheet aria-hidden="true" className="size-4" />
              Excel
            </Button>
          </>
        }
      />
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data && !list.error && <Loading label="Loading the feedback" />}
      {list.data && (
        <>
          <section aria-label="Ratings" className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Average rating</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums text-navy-900">
                {list.data.average?.toFixed(2) ?? "—"}
                <span className="text-sm font-semibold text-muted"> / 5</span>
              </p>
              <p className="text-xs text-muted">{plural(total, "response")}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = list.data!.ratings[String(n)] ?? 0;
                return (
                  <div key={n} className="flex items-center gap-3 py-0.5 text-sm">
                    <Stars value={n} />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums text-muted">{count}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
            <Field label="Search" htmlFor="fb-search">
              <Input id="fb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, team, college, or words in the feedback" />
            </Field>
            <Field label="Rating" htmlFor="fb-rating">
              <Select id="fb-rating" value={rating} onChange={(e) => setRating(e.target.value)}>
                <option value="">Every rating</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? "" : "s"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Who" htmlFor="fb-role">
              <Select id="fb-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Everyone</option>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {shown.length === 0 ? (
            <EmptyState title={total ? "No feedback matches" : "No feedback yet"}>
              {total ? "Change the search or the filters." : "Feedback sent from the letter on the home page appears here."}
            </EmptyState>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {shown.map((f) => (
                <li key={f.id} className="flex min-w-0 flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-navy-900">{f.name}</p>
                      <p className="break-all text-xs text-muted">
                        {f.email}
                        {f.phone && ` · ${f.phone}`}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-navy-800">
                        <Pill tone={f.signedIn ? "green" : "slate"}>{ROLE_LABELS[f.role]}</Pill>
                        {f.teamCode && <span className="font-semibold">{`${f.teamCode} ${f.teamName}`.trim()}</span>}
                        {f.institution && <span className="text-muted">{f.institution}</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <Stars value={f.rating} />
                      <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(f.createdAt)}</p>
                    </div>
                  </div>
                  {f.liked && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Enjoyed</p>
                      <p className="whitespace-pre-line break-words text-sm text-navy-800">{f.liked}</p>
                    </div>
                  )}
                  {f.improve && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-600">Could be better</p>
                      <p className="whitespace-pre-line break-words text-sm text-navy-800">{f.improve}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
