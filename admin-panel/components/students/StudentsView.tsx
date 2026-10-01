"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, X } from "lucide-react";
import { api, errorMessage, MAX_SEARCH_LENGTH } from "@/lib/api";
import type { AdminStudent, StudentQuery, StudentSort } from "@/lib/admin-types";
import { useAdmin } from "@/lib/auth/AuthProvider";
import { departments } from "@/lib/content";
import { downloadStudents, downloadStudentsExcel } from "@/lib/export";
import { formatDate, plural, typeShortLabels } from "@/lib/format";
import { collegeYears, schoolClasses, yearLabel } from "@/lib/rules";
import type { ParticipantType } from "@/lib/types";
import { useQuery } from "@/lib/use-query";
import { intParam, pageSizeParam, pickParam, useUrlParams } from "@/lib/use-url-params";
import { useSelection } from "@/lib/use-selection";
import { teamHref } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ExportDialog, type ExportFormat, type ExportScope } from "@/components/ui/ExportDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Loading, Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { lastPage, PageSizeSelect, Pagination } from "@/components/ui/Pagination";
import { SelectionBar } from "@/components/ui/SelectionBar";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { SearchBox } from "@/components/ui/SearchBox";
import { SortableTh, TableFrame, tdClass, Th } from "@/components/ui/Table";

const types: ParticipantType[] = ["kiet", "college", "school"];
const sorts: StudentSort[] = ["name", "email", "department", "year", "institution", "created_at"];
const studentKey = (student: AdminStudent) => student.userId;

export function StudentsView() {
  const admin = useAdmin();
  const isSuper = admin.role === "super_admin";
  const outside = admin.role === "outside_admin";
  const typeChoices = isSuper ? types : outside ? types.filter((t) => t !== "kiet") : [];
  const { params, update, reset } = useUrlParams();
  const [searchKey, setSearchKey] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const selection = useSelection(studentKey);

  const inTeam = params.get("team");
  const query: StudentQuery = {
    type: typeChoices.length ? pickParam(params, "type", typeChoices) : undefined,
    department: isSuper ? pickParam(params, "department", departments) : undefined,
    year: intParam(params, "year", 1, 12),
    inTeam: inTeam === "yes" || inTeam === "no" ? inTeam : undefined,
    q: params.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    sort: pickParam(params, "sort", sorts) ?? "name",
    order: params.get("order") === "desc" ? "desc" : "asc",
    page: intParam(params, "page", 1, 10_000) ?? 1,
    pageSize: pageSizeParam(params),
  };
  const { data, error, loading } = useQuery(JSON.stringify(query), () => api.listStudents(query));
  const filtered = Boolean(query.type || query.department || query.year || query.inTeam || query.q);

  function onSort(sort: StudentSort) {
    update({ sort, order: query.sort === sort && query.order === "asc" ? "desc" : "asc" });
  }

  // Every page of the current filters, in the current order: what "all matching" means for selecting and exporting.
  const allMatching = () => api.exportStudents({ ...query, page: undefined, pageSize: undefined });

  async function selectAllMatching() {
    setSelectingAll(true);
    setSelectError(null);
    try {
      selection.replace(await allMatching());
    } catch (err) {
      setSelectError(errorMessage(err));
    } finally {
      setSelectingAll(false);
    }
  }

  async function exportRows(scope: ExportScope, format: ExportFormat) {
    const rows =
      scope === "selected"
        ? selection.rows
        : scope === "page"
          ? (data?.items ?? [])
          : scope === "matching"
            ? await allMatching()
            : await api.exportStudents({ sort: query.sort, order: query.order });
    if (format === "xlsx") await downloadStudentsExcel(rows);
    else downloadStudents(rows);
  }

  const sortProps = { sort: query.sort ?? "name", order: query.order ?? "asc", onSort } as const;
  const showClasses = typeChoices.includes("school") && query.type !== "kiet" && query.type !== "college";
  const showYears = query.type !== "school";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isSuper ? "All participants" : outside ? "Other colleges and schools" : `${admin.department} department`}
        title="Students"
        description={
          isSuper
            ? "Everyone who has registered, whether or not they have joined a team."
            : outside
              ? "Students from other colleges and schools, whether or not they have joined a team."
            : `KIET students registered in ${admin.department}, including those in teams led by other departments.`
        }
        actions={
          <Button variant="secondary" onClick={() => setExportOpen(true)} disabled={!data || data.total === 0}>
            <Download aria-hidden="true" className="size-4" />
            Export
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
          {typeChoices.length > 0 && (
            <Field label="Participant type" htmlFor="filter-type">
              <Select id="filter-type" value={query.type ?? ""} onChange={(e) => update({ type: e.target.value, year: null })}>
                <option value="">All types</option>
                {typeChoices.map((t) => (
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
        <div className="flex flex-wrap items-center gap-2">
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
          <PageSizeSelect value={query.pageSize ?? 25} onChange={(size) => update({ size })} />
        </div>
      </div>

      <SelectionBar
        count={selection.size}
        noun={{ one: "student", many: "students" }}
        matching={data?.total ?? 0}
        selectingAll={selectingAll}
        onSelectAll={selectAllMatching}
        onClear={selection.clear}
        onExport={() => setExportOpen(true)}
      />
      {selectError && <Notice tone="error">{selectError}</Notice>}
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
                  <Th className="w-10">
                    <Checkbox
                      label="Select all students on this page"
                      checked={data.items.every(selection.has)}
                      indeterminate={data.items.some(selection.has)}
                      onChange={(on) => selection.setMany(data.items, on)}
                    />
                  </Th>
                  <SortableTh label="Name" sortKey="name" {...sortProps} />
                  <SortableTh label="Email" sortKey="email" {...sortProps} />
                  <Th>Phone</Th>
                  <SortableTh label={isSuper ? "Department / institution" : outside ? "Institution" : "Department"} sortKey="department" {...sortProps} />
                  <SortableTh label="Year" sortKey="year" {...sortProps} />
                  <Th>Roll no.</Th>
                  <Th>Team</Th>
                  <SortableTh label="Registered" sortKey="created_at" {...sortProps} />
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => {
                  const teamVisible = s.team && (isSuper || outside || s.team.department === admin.department);
                  return (
                    <tr key={s.userId} className={selection.has(s) ? "bg-brand-50/70" : "hover:bg-surface/70"}>
                      <td className={tdClass}>
                        <Checkbox label={`Select ${s.fullName}`} checked={selection.has(s)} onChange={() => selection.toggle(s)} />
                      </td>
                      <td className={`${tdClass} whitespace-nowrap font-semibold text-navy-900`}>{s.fullName}</td>
                      <td className={`${tdClass} break-all`}>{s.email}</td>
                      <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{s.phone}</td>
                      <td className={tdClass}>
                        {s.department ?? <span className="block max-w-56">{s.institution}</span>}
                        {typeChoices.length > 0 && (
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

      {exportOpen && data && (
        <ExportDialog
          noun={{ one: "student", many: "students" }}
          counts={{ selected: selection.size, page: data.items.length, matching: data.total }}
          filtered={filtered}
          formatNote="One Students sheet with contact details, institution, year and team."
          onExport={exportRows}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
