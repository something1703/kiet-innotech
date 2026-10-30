"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MapPin, Search, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import type { JudgeFinaleTeams, JudgeTeam } from "@/lib/admin-types";
import { plural } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";

const SHOWN = 24;

/** Lower case, accents off: "Café" finds "cafe". */
const norm = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
/** Letters and digits only: "F3-07", "f3 07" and "F307" are the same; so are "IT26-0492" and "it260492". */
const compact = (value: string) => norm(value).replace(/[^a-z0-9]/g, "");

/** The venue a team's place starts with: "G Block · Floor 3", "Badminton Court"; "Not placed" when it has none. */
export function venueOf(team: JudgeTeam) {
  if (!team.place) return "Not placed";
  const parts = team.place.split(" · ");
  return parts[0] === "G Block" && parts[1] ? `${parts[0]} · ${parts[1]}` : parts[0];
}

type Indexed = { team: JudgeTeam; text: string; flat: string; number: string; stall: string };

function index(team: JudgeTeam): Indexed {
  const fields = [
    team.name,
    team.code,
    team.tent ?? "",
    team.tent ? `stall ${team.tent} octonorm ${team.tent}` : "",
    team.place,
    team.panel,
    team.section,
    `category ${team.category} cat ${team.category}`,
    team.projectTitle,
    team.domain,
    team.institution,
    team.department ?? "",
    team.club,
    team.leaderName,
    ...team.members.map((m) => m.fullName),
  ];
  return {
    team,
    text: norm(fields.join(" | ")),
    flat: compact(fields.join(" ")),
    number: String(Number(team.code.replace(/\D/g, "").slice(-4))),
    stall: compact(team.tent ?? ""),
  };
}

/**
 * How well a team fits the search, or 0 when it does not: every word must be found somewhere (stall, code, name, project,
 * college or school, department, club, leader, any member, category, section, floor, panel). An exact stall or code
 * comes first, then a name that starts with the search.
 */
function score(item: Indexed, query: string): number {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const q = compact(query);
  let points = 0;
  for (const word of words) {
    const w = compact(word);
    const numeric = /^\d+$/.test(w);
    if (item.text.includes(word)) points += 1;
    else if (w && item.flat.includes(w)) points += 1;
    else if (numeric && (item.number === String(Number(w)) || item.stall === w)) points += 1;
    else return 0;
  }
  if (q && (item.stall === q || compact(item.team.code) === q || (/^\d+$/.test(q) && (item.number === String(Number(q)) || item.stall === q)))) points += 100;
  if (norm(item.team.name).startsWith(norm(query.trim()))) points += 10;
  // The whole search found as written ("floor 3", "room g-006") outranks its words found apart.
  if (words.length > 1 && item.text.includes(words.join(" "))) points += 50;
  return points;
}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * At the top of a Grand Finale judge's page: find any Grand Finale team and score it, when a team moved, is not in the
 * judge's room, or its judge is busy. Marks count like any other. Shows who else has marked each team (never the marks).
 */
export function NotInMyRoom({
  refresh,
  canScore,
  onScore,
}: {
  /** Changes after marks are saved, so the list reloads. */
  refresh: number;
  /** Whether scoring is open for this judge's Grand Finale panel. */
  canScore: boolean;
  onScore: (team: JudgeTeam, list: JudgeFinaleTeams) => void;
}) {
  const list = useQuery("judge-finale-teams", () => api.judgeFinaleTeams());
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState("");
  const [section, setSection] = useState("");
  const [hideMine, setHideMine] = useState(true);
  const [unscoredOnly, setUnscoredOnly] = useState(false);
  const [limit, setLimit] = useState(SHOWN);
  const { reload } = list;
  useEffect(() => {
    if (refresh) reload();
  }, [refresh, reload]);

  const indexed = useMemo(() => (list.data?.teams ?? []).map(index), [list.data]);
  const venues = useMemo(() => [...new Set(indexed.map((i) => venueOf(i.team)))].sort(natural), [indexed]);
  const sections = useMemo(() => [...new Set(indexed.map((i) => i.team.section))].sort(natural), [indexed]);
  const outsideMine = indexed.filter((i) => !i.team.inMyPanel && i.team.myScore);
  const searching = query.trim() !== "" || venue !== "" || section !== "" || unscoredOnly;
  const results = indexed
    .filter((i) => (!hideMine || !i.team.inMyPanel) && (!venue || venueOf(i.team) === venue) && (!section || i.team.section === section) && (!unscoredOnly || (!i.team.myScore && i.team.otherJudges.length === 0)))
    .map((i) => ({ i, points: score(i, query) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || natural(a.i.team.tent ?? "~", b.i.team.tent ?? "~") || natural(a.i.team.code, b.i.team.code))
    .map((r) => r.i.team);
  const locked = list.data?.locked ?? false;

  function clear() {
    setQuery("");
    setVenue("");
    setSection("");
    setUnscoredOnly(false);
    setLimit(SHOWN);
  }

  return (
    <section aria-labelledby="not-in-room" className="overflow-hidden rounded-3xl bg-white ring-1 ring-line">
      <header className="border-b border-line bg-navy-900 px-4 py-4 text-white sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-500">Grand Finale</p>
        <h2 id="not-in-room" className="font-display text-xl font-bold">
          Not in your room?
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-white/80">
          Find any Grand Finale team and score it, for a team that moved, is not on your list, or whose judge is busy. One judge marks a team: a team
          another judge has already marked shows who, and cannot be marked again.
        </p>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        {list.error && <Notice tone="error">{list.error}</Notice>}
        {!list.data && !list.error && <Loading label="Loading the Grand Finale teams" />}
        {list.data && (
          <>
            {locked && <Notice tone="info">{list.data.open ? "Your Grand Finale marks are locked." : "Scoring is not open right now."} You can still look teams up.</Notice>}
            {outsideMine.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-navy-800">
                <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600" />
                You marked {plural(outsideMine.length, "team")} outside your room:
                {outsideMine.map((i) => (
                  <button
                    key={i.team.id}
                    type="button"
                    onClick={() => onScore(i.team, list.data!)}
                    className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"
                  >
                    {i.team.tent ? `${i.team.tent} · ` : ""}
                    {i.team.name}
                  </button>
                ))}
              </p>
            )}

            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
              <Input
                aria-label="Search every Grand Finale team"
                value={query}
                onChange={(e) => (setQuery(e.target.value), setLimit(SHOWN))}
                placeholder="Stall (F3-07), team, code (0492), project, college or school, member, club, floor…"
                className="h-12 pl-12 pr-11 text-base"
                autoComplete="off"
                enterKeyHint="search"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-surface hover:text-navy-900">
                  <X aria-hidden="true" className="size-4" />
                  <span className="sr-only">Clear the search</span>
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Venue" htmlFor="nir-venue">
                <Select id="nir-venue" value={venue} onChange={(e) => (setVenue(e.target.value), setLimit(SHOWN))}>
                  <option value="">Every venue</option>
                  {venues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category or section" htmlFor="nir-section">
                <Select id="nir-section" value={section} onChange={(e) => (setSection(e.target.value), setLimit(SHOWN))}>
                  <option value="">Every category and section</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-navy-800">
              <label className="inline-flex items-center gap-2">
                <Checkbox label="Hide the teams of my own room" checked={hideMine} onChange={setHideMine} />
                Hide the teams of my own room
              </label>
              <label className="inline-flex items-center gap-2">
                <Checkbox label="Only teams nobody has marked" checked={unscoredOnly} onChange={setUnscoredOnly} />
                Only teams nobody has marked
              </label>
              {searching && (
                <button type="button" onClick={clear} className="font-semibold text-accent-600 hover:underline">
                  Clear the search
                </button>
              )}
            </div>

            {!searching ? (
              <p className="text-sm text-muted">Type a stall, team, code, name or college, or pick a venue, to find a team among {plural(indexed.length, "Grand Finale team")}.</p>
            ) : results.length === 0 ? (
              <Notice tone="info">No Grand Finale team matches. Try fewer words, the stall (e.g. F3-07), the team code (e.g. 0492) or a member&apos;s name.</Notice>
            ) : (
              <>
                <p className="text-xs font-semibold text-muted">{plural(results.length, "team")} found</p>
                <ul className="grid gap-3 md:grid-cols-2">
                  {results.slice(0, limit).map((team) => (
                    <FoundTeam key={team.id} team={team} canScore={canScore && !locked && !(team.otherJudges.length > 0 && !team.myScore)} onScore={() => onScore(team, list.data!)} />
                  ))}
                </ul>
                {results.length > limit && (
                  <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + SHOWN)}>
                    Show {Math.min(SHOWN, results.length - limit)} more
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function FoundTeam({ team, canScore, onScore }: { team: JudgeTeam; canScore: boolean; onScore: () => void }) {
  const leader = team.members.find((m) => m.role === "leader");
  const scored = !!team.myScore;
  return (
    <li className={`flex min-w-0 flex-col rounded-2xl p-4 ring-1 ring-inset ${scored ? "bg-emerald-50/60 ring-emerald-200" : "bg-white ring-line"}`}>
      <div className="flex items-start gap-3">
        <span className="grid min-w-14 shrink-0 place-items-center rounded-xl bg-navy-900 px-2 py-1.5 text-white">
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/70">Stall</span>
          <span className="font-display text-base font-bold leading-tight">{team.tent ?? "—"}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-base font-bold text-navy-900">{team.name}</span>
            <span className="font-mono text-xs text-muted">{team.code}</span>
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-navy-800">{team.projectTitle}</p>
          {team.place && (
            <p className="mt-1 flex items-start gap-1 text-xs font-semibold text-accent-600">
              <MapPin aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              {team.place}
            </p>
          )}
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="inline-flex max-w-full rounded-lg bg-navy-900 px-2 py-0.5 text-[11px] font-semibold text-white">{team.section}</span>
            {team.inMyPanel && <span className="inline-flex rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Your room</span>}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {team.participantType === "kiet" ? `KIET ${team.club || team.department || ""}` : team.institution}
            {leader && ` · ${leader.fullName} (leader)`}
            {` · ${team.panel || "Not in a panel"}`}
          </p>
          {team.otherJudges.length > 0 && (
            <p className="mt-1.5 flex items-start gap-1 text-xs font-semibold text-accent-600">
              <Users aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              Already scored by {team.otherJudges.join(", ")}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className={`text-xs font-semibold ${scored ? "text-emerald-700" : "text-muted"}`}>
          {scored ? "You marked this team" : team.otherJudges.length > 0 ? "Marked by another judge" : "Not marked yet"}
        </span>
        <Button size="sm" variant={scored || !canScore ? "secondary" : "primary"} onClick={onScore}>
          {scored ? "Review / edit" : canScore ? "Score team" : "View"}
        </Button>
      </div>
    </li>
  );
}
