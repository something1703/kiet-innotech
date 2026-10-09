"use client";

import { useEffect, useId, useState } from "react";
import { Crown, Search, UserPlus, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { AdminStudent, AdminTeam } from "@/lib/admin-types";
import { categories, departmentLabel, domains } from "@/lib/content";
import { typeShortLabels } from "@/lib/format";
import { categoryEligibility, limits, normaliseInstitution, TEAM_MAX_SIZE, TEAM_MIN_SIZE, teamSizeLimits, yearLabel } from "@/lib/rules";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

/** Registered students without a team who match the search, for picking members. */
function StudentFinder({ exclude, onPick }: { exclude: string[]; onPick: (student: AdminStudent) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [results, setResults] = useState<AdminStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.listStudents({ q: q.slice(0, 100), inTeam: "no", pageSize: 8 }).then(
        (page) => {
          if (!cancelled) {
            setResults(page.items);
            setError(null);
          }
        },
        (err: unknown) => {
          if (!cancelled) setError(errorMessage(err));
        },
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text]);

  const shown = text.trim().length < 2 ? null : (results ?? []).filter((s) => !exclude.includes(s.email.toLowerCase()));

  return (
    <div>
      <Field label="Find a registered student" htmlFor={id} hint="Name, email, roll number or phone. Only students who are not in a team are listed.">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="Start typing…" autoComplete="off" className="pl-9" />
        </div>
      </Field>
      {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
      {shown && (
        <ul className="mt-2 max-h-48 divide-y divide-line overflow-y-auto overscroll-contain rounded-xl ring-1 ring-line">
          {shown.length === 0 && <li className="px-3 py-2.5 text-xs text-muted">No students without a team match.</li>}
          {shown.map((s) => (
            <li key={s.userId}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-navy-900">{s.fullName}</span>
                  <span className="block truncate text-xs text-muted">
                    {s.email} · {s.department ?? s.institution} · {yearLabel(s.year, s.participantType)}
                  </span>
                </span>
                <UserPlus aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Errors = Partial<Record<"name" | "projectTitle" | "abstract" | "members" | "category", string>>;

/**
 * Organisers create a team for registered students, whether registration is open or not (help-desk cases).
 * The server applies the team rules again; this form checks them early so mistakes are clear.
 */
export function CreateTeamDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (team: AdminTeam) => void }) {
  const [people, setPeople] = useState<AdminStudent[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(1);
  const [domain, setDomain] = useState(domains[0]);
  const [projectTitle, setProjectTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [submit, setSubmit] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const leader = people[0];
  // A startup is a single entry; every other team has 2 to 5 members.
  const [minSize, maxSize] = leader ? teamSizeLimits(leader.participantType) : [TEAM_MIN_SIZE, TEAM_MAX_SIZE];
  const eligibility = leader ? categoryEligibility(category, leader.participantType, people.map((p) => p.year)) : null;
  const mismatch = leader
    ? people.slice(1).find((p) => p.participantType !== leader.participantType || (leader.participantType !== "kiet" && normaliseInstitution(p.institution) !== normaliseInstitution(leader.institution)))
    : undefined;

  function add(student: AdminStudent) {
    if (people.length >= maxSize) return;
    setPeople((list) => [...list, student]);
  }

  async function save() {
    const next: Errors = {};
    if (name.trim().length < limits.teamName.min) next.name = `At least ${limits.teamName.min} characters.`;
    if (projectTitle.trim().length < limits.projectTitle.min) next.projectTitle = `At least ${limits.projectTitle.min} characters.`;
    if (abstract.trim().length < limits.abstract.min) next.abstract = `At least ${limits.abstract.min} characters (${abstract.trim().length} so far).`;
    if (!leader) next.members = "Add the team leader.";
    else if (leader.participantType === "startup" && people.length > 1) next.members = "A startup is a single entry, so it has no teammates.";
    else if (submit && people.length < minSize) next.members = `A submitted team needs ${minSize} to ${maxSize} members.`;
    else if (mismatch) next.members = `${mismatch.fullName} is not from the same college or school as the leader.`;
    if (eligibility && !eligibility.allowed) next.category = eligibility.reason;
    setErrors(next);
    setError(null);
    if (Object.keys(next).length) return;
    setPending(true);
    try {
      const team = await api.createTeam({
        name: name.trim(),
        category,
        domain,
        projectTitle: projectTitle.trim(),
        abstract: abstract.trim(),
        leaderEmail: leader.email,
        memberEmails: people.slice(1).map((p) => p.email),
        submit,
      });
      onCreated(team);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      title="Create a team"
      description="For registered students, whether or not registration is open. The usual team rules still apply, and it is recorded in the activity log."
      onClose={onClose}
      busy={pending}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} pending={pending}>
            {submit ? "Create and submit" : "Create as draft"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section aria-labelledby="create-members" className="space-y-3">
          <h3 id="create-members" className="text-sm font-semibold text-navy-900">
            Members <span className="font-normal text-muted">({people.length}/{Math.max(maxSize, people.length)}; the first is the leader)</span>
          </h3>
          {people.length > 0 && (
            <ol className="divide-y divide-line rounded-xl ring-1 ring-line">
              {people.map((p, index) => (
                <li key={p.userId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-navy-900">
                      {index === 0 && <Crown aria-label="Leader" className="size-3.5 text-accent-500" />}
                      <span className="truncate">{p.fullName}</span>
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {p.email} · {p.participantType === "kiet" ? p.department : `${typeShortLabels[p.participantType]}${p.participantType === "startup" ? "" : `, ${p.institution}`}`} · {yearLabel(p.year, p.participantType)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {index > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setPeople((list) => [p, ...list.filter((x) => x !== p)])}>
                        Make leader
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPeople((list) => list.filter((x) => x !== p))}
                      aria-label={`Remove ${p.fullName}`}
                      className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-red-700"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {people.length < maxSize && <StudentFinder exclude={people.map((p) => p.email.toLowerCase())} onPick={add} />}
          {errors.members && <p className="text-xs font-medium text-red-700">{errors.members}</p>}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Team name" htmlFor="create-name" error={errors.name}>
            <Input id="create-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={limits.teamName.max} />
          </Field>
          <Field label="Category" htmlFor="create-category" error={errors.category ?? (eligibility && !eligibility.allowed ? eligibility.reason : null)}>
            <Select id="create-category" value={category} onChange={(e) => setCategory(Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.number} value={c.number}>{c.number}. {c.title}</option>
              ))}
            </Select>
          </Field>
          <Field label="Domain" htmlFor="create-domain" className="sm:col-span-2">
            <Select id="create-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
              {domains.map((d) => (
                <option key={d} value={d}>{departmentLabel(d)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Project title" htmlFor="create-title" error={errors.projectTitle} className="sm:col-span-2">
            <Input id="create-title" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} maxLength={limits.projectTitle.max} />
          </Field>
          <Field label="Abstract" htmlFor="create-abstract" error={errors.abstract} hint={`${limits.abstract.min} to ${limits.abstract.max} characters.`} className="sm:col-span-2">
            <Textarea id="create-abstract" value={abstract} onChange={(e) => setAbstract(e.target.value)} maxLength={limits.abstract.max} />
          </Field>
        </div>

        <div className="rounded-xl bg-surface px-3 py-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox label="Submit it now" checked={submit} onChange={setSubmit} />
            <span>
              <span className="font-semibold text-navy-900">Submit it now</span>
              <span className="block text-xs text-muted">Locks the team for judging. Needs {minSize === maxSize ? `exactly ${minSize}` : `${minSize} to ${maxSize}`} {maxSize === 1 ? "member" : "members"}. Leave unticked to create a draft.</span>
            </span>
          </label>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}
