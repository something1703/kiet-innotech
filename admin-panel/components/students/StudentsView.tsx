"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, X } from "lucide-react";
import { api, DEFAULT_PAGE_SIZE, errorMessage, MAX_SEARCH_LENGTH } from "@/lib/api";
import type { StudentQuery, StudentSort } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { departments } from "@/lib/content";
import { downloadStudents } from "@/lib/export";
import { formatDate, plural, typeShortLabels } from "@/lib/format";
import { collegeYears, schoolClasses, yearLabel } from "@/lib/rules";
import type { ParticipantType } from "@/lib/types";
import { useQuery } from "@/lib/use-query";
import { intParam, pickParam, useUrlParams } from "@/lib/use-url-params";
import { teamHref } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { lastPage, Pagination } from "@/components/ui/Pagination";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { SearchBox } from "@/components/ui/SearchBox";
import { SortableTh, TableFrame, tdClass, Th } from "@/components/ui/Table";

const types: ParticipantType[] = ["kiet", "college", "school"];
const sorts: StudentSort[] = ["name", "email", "department", "year", "institution", "created_at"];

export function StudentsView() {
  const admin = useAdmin();
  const isSuper = admin.role === "super_admin";
  const { params, update, reset } = useUrlParams();
  const [searchKey, setSearchKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const inTeam = params.get("team");
  const query: StudentQuery = {
    type: isSuper ? pickParam(params, "type", types) : undefined,
    department: isSuper ? pickParam(params, "department", departments) : undefined,
    year: intParam(params, "year", 1, 12),
    inTeam: inTeam === "yes" || inTeam === "no" ? inTeam : undefined,
    q: params.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    sort: pickParam(params, "sort", sorts) ?? "name",
    order: params.get("order") === "desc" ? "desc" : "asc",
    page: intParam(params, "page", 1, 10_000) ?? 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
  const { data, error, loading } = useQuery(JSON.stringify(query), () => api.listStudents(query));
  const filtered = Boolean(query.type || query.department || query.year || query.inTeam || query.q);

  function onSort(sort: StudentSort) {
    update({ sort, order: query.sort === sort && query.order === "asc" ? "desc" : "asc" });
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      downloadStudents(await api.exportStudents({ ...query, page: undefined, pageSize: undefined }));
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const sortProps = { sort: query.sort ?? "name", order: query.order ?? "asc", onSort } as const;
  const showClasses = isSuper && query.type !== "kiet" && query.type !== "college";
  const showYears = query.type !== "school";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isSuper ? "All participants" : `${admin.department} department`}
        title="Students"
        description={
          isSuper
            ? "Everyone who has registered, whether or not they have joined a team."
            : `KIET students registered in ${admin.department}, including those in teams led by other departments.`
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
          id="student-search"
          label="Search students"
          placeholder="Name, email, roll number, phone or institution"
          value={query.q ?? ""}
          onSearch={(q) => update({ q })}
        />
        <div className={`grid grid-cols-2 gap-3 ${isSuper ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {isSuper && (
            <Field label="Participant type" htmlFor="filter-type">
              <Select id="filter-type" value={query.type ?? ""} onChange={(e) => update({ type: e.target.value, year: null })}>
                <option value="">All types</option>
                {types.map((t) => (
                  <option key={t} value={t}>{typeShortLabels[t]}</option>
                ))}
              </Select>
            </Field>
          )}
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
          <Field label="Year / class" htmlFor="filter-year">
            <Select id="filter-year" value={query.year ?? ""} onChange={(e) => update({ year: e.target.value })}>
              <option value="">Any year</option>
              {showYears && collegeYears.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
              {showClasses && schoolClasses.map((y) => <option key={y} value={y}>{yearLabel(y, "school")}</option>)}
            </Select>
          </Field>
          <Field label="Team" htmlFor="filter-team">
            <Select id="filter-team" value={query.inTeam ?? ""} onChange={(e) => update({ team: e.target.value })}>
              <option value="">In a team or not</option>
              <option value="yes">In a team</option>
              <option value="no">Not in a team</option>
            </Select>
          </Field>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted" aria-live="polite">
          {data ? (
            <>
              <span className="font-semibold text-navy-900">{plural(data.total, "student")}</span>
              {filtered ? " match these filters" : " registered"}
            </>
          ) : (
            "Loading students…"
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
      {!data && !error && <Loading label="Loading students" />}

      {data && data.total === 0 && (
        <EmptyState title="No students found">{filtered ? "Try removing a filter or searching for something else." : "Nobody has registered yet."}</EmptyState>
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
              The list is shorter than this page number, possibly because students were removed since the link was made.
            </EmptyState>
          ) : (
            <TableFrame label="Students" minWidth="min-w-[1000px]">
              <thead>
                <tr>
                  <SortableTh label="Name" sortKey="name" {...sortProps} />
                  <SortableTh label="Email" sortKey="email" {...sortProps} />
                  <Th>Phone</Th>
                  <SortableTh label={isSuper ? "Department / institution" : "Department"} sortKey="department" {...sortProps} />
                  <SortableTh label="Year" sortKey="year" {...sortProps} />
                  <Th>Roll no.</Th>
                  <Th>Team</Th>
                  <SortableTh label="Registered" sortKey="created_at" {...sortProps} />
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => {
                  const teamVisible = s.team && (isSuper || s.team.department === admin.department);
                  return (
                    <tr key={s.userId} className="hover:bg-surface/70">
                      <td className={`${tdClass} whitespace-nowrap font-semibold text-navy-900`}>{s.fullName}</td>
                      <td className={`${tdClass} break-all`}>{s.email}</td>
                      <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{s.phone}</td>
                      <td className={tdClass}>
                        {s.department ?? <span className="block max-w-56">{s.institution}</span>}
                        {isSuper && (
                          <span className="mt-0.5 block">
                            <Pill tone={s.participantType === "kiet" ? "navy" : "cyan"}>{typeShortLabels[s.participantType]}</Pill>
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {yearLabel(s.year, s.participantType)}
                        <span className="block text-xs text-muted">{s.course}</span>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>{s.rollNumber || "—"}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {s.team ? (
                          <>
                            {teamVisible ? (
                              <Link href={teamHref(s.team.id)} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                                {s.team.code}
                              </Link>
                            ) : (
                              <span className="font-mono text-xs font-semibold" title={`Led by a ${s.team.department} student`}>
                                {s.team.code}
                              </span>
                            )}
                            <span className="ml-1.5 text-xs text-muted">{s.team.role === "leader" ? "Leader" : "Member"}</span>
                            <span className="mt-0.5 block">
                              <StatusPill status={s.team.status} />
                            </span>
                            {!teamVisible && <span className="block text-xs text-muted">{s.team.department} team</span>}
                          </>
                        ) : (
                          <span className="text-muted">Not in a team</span>
                        )}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDate(s.createdAt)}</td>
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
