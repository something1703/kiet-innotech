"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, X } from "lucide-react";
import { api, DEFAULT_PAGE_SIZE, errorMessage, MAX_SEARCH_LENGTH } from "@/lib/api";
import type { TeamQuery, TeamSort } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { categories, departments } from "@/lib/content";
import { downloadTeams } from "@/lib/export";
import { formatDate, otherMemberDepartments, plural, routeLabels, statusLabels, typeShortLabels } from "@/lib/format";
import type { ParticipantType, TeamRoute, TeamStatus } from "@/lib/types";
import { useQuery } from "@/lib/use-query";
import { intParam, pickParam, useUrlParams } from "@/lib/use-url-params";
import { teamHref } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { lastPage, Pagination } from "@/components/ui/Pagination";
import { Pill, ResultPill, StatusPill } from "@/components/ui/Pill";
import { SearchBox } from "@/components/ui/SearchBox";
import { numClass, SortableTh, TableFrame, tdClass, Th } from "@/components/ui/Table";

const statuses: TeamStatus[] = ["draft", "submitted", "withdrawn", "disqualified"];
const types: ParticipantType[] = ["kiet", "college", "school"];
const routes: TeamRoute[] = ["department", "finale"];
const sorts: TeamSort[] = ["code", "name", "category", "department", "status", "members", "submitted_at"];

export function TeamsView() {
  const admin = useAdmin();
  const isSuper = admin.role === "super_admin";
  const { params, update, reset } = useUrlParams();
  const [searchKey, setSearchKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const query: TeamQuery = {
    department: isSuper ? pickParam(params, "department", departments) : undefined,
    category: intParam(params, "category", 1, categories.length),
    status: pickParam(params, "status", statuses),
    type: isSuper ? pickParam(params, "type", types) : undefined,
    route: isSuper ? pickParam(params, "route", routes) : undefined,
    q: params.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    sort: pickParam(params, "sort", sorts) ?? "code",
    order: params.get("order") === "desc" ? "desc" : "asc",
    page: intParam(params, "page", 1, 10_000) ?? 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
  const key = JSON.stringify(query);
  const { data, error, loading } = useQuery(key, () => api.listTeams(query));
  const filtered = Boolean(query.department || query.category || query.status || query.type || query.route || query.q);

  function onSort(sort: TeamSort) {
    update({ sort, order: query.sort === sort && query.order === "asc" ? "desc" : "asc" });
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      downloadTeams(await api.exportTeams({ ...query, page: undefined, pageSize: undefined }));
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const sortProps = { sort: query.sort ?? "code", order: query.order ?? "asc", onSort } as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isSuper ? "All participants" : `${admin.department} department`}
        title="Teams"
        description={
          isSuper
            ? "Every team from KIET departments, other colleges and schools."
            : `Teams whose leader is a ${admin.department} student. Members may come from other branches.`
        }
        actions={
          <Button variant="secondary" onClick={exportCsv} pending={exporting} disabled={!data || data.total === 0}>
            {!exporting && <Download aria-hidden="true" className="size-4" />}
            Export CSV
          </Button>
        }
      />

      <form role="search" onSubmit={(e) => e.preventDefault()} className="space-y-3">
        <SearchBox
          key={searchKey}
          id="team-search"
          label="Search teams"
          placeholder="Team name, code, member name or email"
          value={query.q ?? ""}
          onSearch={(q) => update({ q })}
        />
        <div className={`grid grid-cols-2 gap-3 ${isSuper ? "md:grid-cols-3 xl:grid-cols-5" : "md:grid-cols-3"}`}>
          {isSuper && (
            <Field label="Department" htmlFor="filter-department">
              <Select id="filter-department" value={query.department ?? ""} onChange={(e) => update({ department: e.target.value })}>
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Category" htmlFor="filter-category">
            <Select id="filter-category" value={query.category ?? ""} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.number} value={c.number}>{c.number}. {c.title}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="filter-status">
            <Select id="filter-status" value={query.status ?? ""} onChange={(e) => update({ status: e.target.value })}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </Select>
          </Field>
          {isSuper && (
            <Field label="Participant type" htmlFor="filter-type">
              <Select id="filter-type" value={query.type ?? ""} onChange={(e) => update({ type: e.target.value })}>
                <option value="">All types</option>
                {types.map((t) => (
                  <option key={t} value={t}>{typeShortLabels[t]}</option>
                ))}
              </Select>
            </Field>
          )}
          {isSuper && (
            <Field label="Route" htmlFor="filter-route">
              <Select id="filter-route" value={query.route ?? ""} onChange={(e) => update({ route: e.target.value })}>
                <option value="">All routes</option>
                {routes.map((r) => (
                  <option key={r} value={r}>{routeLabels[r]}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted" aria-live="polite">
          {data ? (
            <>
              <span className="font-semibold text-navy-900">{plural(data.total, "team")}</span>
              {filtered ? " match these filters" : " in total"}
            </>
          ) : (
            "Loading teams…"
          )}
        </p>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchKey((k) => k + 1);
              reset();
            }}
          >
            <X aria-hidden="true" className="size-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {exportError && <Notice tone="error">{exportError}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <Loading label="Loading teams" />}

      {data && data.total === 0 && (
        <EmptyState title="No teams found">{filtered ? "Try removing a filter or searching for something else." : "No teams have been created yet."}</EmptyState>
      )}

      {data && data.total > 0 && (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          {data.items.length === 0 ? (
            <EmptyState
              title="No results on this page"
              action={
                <Button variant="secondary" size="sm" onClick={() => update({ page: lastPage(data) })} disabled={loading}>
                  Go to page {lastPage(data)}
                </Button>
              }
            >
              The list is shorter than this page number, possibly because teams were removed since the link was made.
            </EmptyState>
          ) : (
            <TableFrame label="Teams" minWidth="min-w-[920px]">
              <thead>
                <tr>
                  <SortableTh label="Code" sortKey="code" {...sortProps} />
                  <SortableTh label="Team" sortKey="name" {...sortProps} />
                  <SortableTh label="Cat." sortKey="category" {...sortProps} />
                  <SortableTh label={isSuper ? "Department / institution" : "Department"} sortKey="department" {...sortProps} />
                  <SortableTh label="Members" sortKey="members" {...sortProps} className={numClass} />
                  <SortableTh label="Status" sortKey="status" {...sortProps} />
                  <SortableTh label="Submitted" sortKey="submitted_at" {...sortProps} />
                  <Th>Result</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((team) => {
                  const leader = team.members.find((m) => m.role === "leader");
                  return (
                    <tr key={team.id} className="hover:bg-surface/70">
                      <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>
                        <Link href={teamHref(team.id)} className="font-semibold text-brand-700 hover:underline">
                          {team.code}
                        </Link>
                      </td>
                      <td className={`${tdClass} min-w-56`}>
                        <Link href={teamHref(team.id)} className="font-semibold text-navy-900 hover:text-brand-700 hover:underline">
                          {team.name}
                        </Link>
                        <p className="text-xs text-muted">Led by {leader?.fullName ?? "—"}</p>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`} title={categories.find((c) => c.number === team.category)?.title}>
                        <span className="font-display font-bold text-navy-900">{team.category}</span>
                      </td>
                      <td className={tdClass}>
                        {team.department ? (
                          <>
                            <span className="font-medium">{team.department}</span>
                            {otherMemberDepartments(team).length > 0 && (
                              <span className="block text-xs text-muted">+ {otherMemberDepartments(team).join(", ")}</span>
                            )}
                          </>
                        ) : (
                          <span className="block max-w-56 text-sm">{team.institution}</span>
                        )}
                        {isSuper && (
                          <span className="mt-0.5 flex gap-1">
                            <Pill tone={team.participantType === "kiet" ? "navy" : "cyan"}>{typeShortLabels[team.participantType]}</Pill>
                            {team.route === "finale" && <Pill tone="orange">Direct to finale</Pill>}
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} ${numClass}`}>
                        {team.members.length}
                        {team.invitations.length > 0 && <span className="block text-xs text-muted">+{team.invitations.length} invited</span>}
                      </td>
                      <td className={tdClass}>
                        <StatusPill status={team.status} />
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDate(team.submittedAt)}</td>
                      <td className={tdClass}>{team.result !== "pending" ? <ResultPill result={team.result} /> : <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </TableFrame>
          )}
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => update({ page })} disabled={loading} />
        </div>
      )}
    </div>
  );
}
