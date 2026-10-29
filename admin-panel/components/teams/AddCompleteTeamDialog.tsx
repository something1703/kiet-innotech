"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { AdminTeam, CompleteTeamMember } from "@/lib/admin-types";
import { categories, clubDepartment, departmentLabel, departments, domains } from "@/lib/content";
import { collegeCourses, collegeYears, kietCourses, schoolClasses, TEAM_MAX_SIZE, yearLabel } from "@/lib/rules";
import type { ParticipantType } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const blank = (): CompleteTeamMember => ({ email: "", fullName: "", phone: "", department: null, course: "", year: 0, rollNumber: "", club: "" });

const typeChoices: { value: ParticipantType; label: string }[] = [
  { value: "college", label: "Other college" },
  { value: "school", label: "School" },
  { value: "kiet", label: "KIET (COE KIET / technical club)" },
  { value: "startup", label: "Startup (one person)" },
];

/**
 * Super admin: adds a whole team in one go, e.g. a team the organisers selected that never registered. Students who are
 * not registered yet are registered with these details (they can later sign in with Google using the same email); the
 * team is submitted, and accepted for the Grand Finale. If anything is wrong, nothing is saved.
 */
export function AddCompleteTeamDialog({
  onClose,
  onCreated,
  wildcard = false,
}: {
  onClose: () => void;
  onCreated: (team: AdminTeam) => void;
  /** A Grand Finale wild card: takes part straight away, with its octonorm (or a building and room) given here. */
  wildcard?: boolean;
}) {
  const [type, setType] = useState<ParticipantType>("college");
  const [octonorm, setOctonorm] = useState("");
  const [building, setBuilding] = useState("");
  const [room, setRoom] = useState("");
  // A KIET wild card can come from any department; otherwise KIET teams added here are COE KIET / technical club teams.
  const [kietDepartment, setKietDepartment] = useState(clubDepartment);
  const [institution, setInstitution] = useState("");
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(0);
  const [domain, setDomain] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [members, setMembers] = useState<CompleteTeamMember[]>([blank(), blank()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kiet = type === "kiet";
  const startup = type === "startup";
  const max = startup ? 1 : TEAM_MAX_SIZE;
  const shown = members.slice(0, max);
  const years = type === "school" ? schoolClasses : collegeYears;
  const courses = kiet ? kietCourses : collegeCourses;

  function change(index: number, patch: Partial<CompleteTeamMember>) {
    setMembers((all) => all.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function check(): string | null {
    if (!kiet && institution.trim().length < (startup ? 2 : 3)) return startup ? "Enter the startup's name." : `Enter the ${type === "school" ? "school" : "college"}'s full name.`;
    if (!kiet && !startup && city.trim().length < 2) return "Enter the city.";
    if (name.trim().length < 3) return "Enter the team name (at least 3 characters).";
    if (!category) return "Choose a category.";
    if (!domain) return "Choose a domain.";
    if (projectTitle.trim().length < 5) return "Enter the project title (at least 5 characters).";
    if (!startup && shown.length < 2) return "A team needs at least 2 students.";
    for (const [i, m] of shown.entries()) {
      const who = m.fullName.trim() || `Student ${i + 1}`;
      if (!EMAIL.test(m.email.trim())) return `${who}: enter a valid email.`;
      if (m.fullName.trim().length < 3) return `Student ${i + 1}: enter the full name.`;
      if (!/^(\+?91)?0?[6-9]\d{9}$/.test(m.phone.replace(/[\s-]/g, ""))) return `${who}: enter a 10-digit mobile number.`;
      if (kiet && !/@kiet\.edu$/i.test(m.email.trim())) return `${who}: KIET students use their @kiet.edu email.`;
    }
    return null;
  }

  async function submit() {
    const problem = check();
    if (problem) return setError(problem);
    setPending(true);
    setError(null);
    try {
      const team = await api.createCompleteTeam({
        name: name.trim(),
        category,
        domain,
        projectTitle: projectTitle.trim(),
        abstract: abstract.trim(),
        participantType: type,
        institution: institution.trim(),
        city: city.trim(),
        members: shown.map((m) => ({
          ...m,
          email: m.email.trim().toLowerCase(),
          fullName: m.fullName.trim(),
          department: kiet ? (wildcard ? kietDepartment : clubDepartment) : null,
          course: type === "school" ? "School" : m.course,
          year: startup ? 0 : m.year,
        })),
        ...(wildcard ? { wildcard: true, octonorm: octonorm.replace(/\s+/g, "").toUpperCase() || null, building: building.trim(), room: room.trim() } : {}),
      });
      onCreated(team);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      title={wildcard ? "Add a wild card team" : "Add a complete team"}
      description={
        wildcard
          ? "A team that joins the Grand Finale now: its students are registered with it (students already registered are used as they are), it takes part straight away and gets the octonorm you give it here."
          : "Register a selected team and its students in one go. Students already registered (same email) are used as they are. The team is submitted and accepted for the Grand Finale; allot its stall on the Judging page."
      }
      size="xl"
      busy={pending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} pending={pending}>
            {!pending && <Plus aria-hidden="true" className="size-4" />}
            Add team
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {wildcard && (
          <div className="grid gap-4 rounded-2xl bg-accent-500/10 p-4 ring-1 ring-accent-500/30 md:grid-cols-3">
            <Field label="Octonorm" htmlFor="ct-octonorm" hint="Its number, e.g. 186. Leave empty to give one later.">
              <Input id="ct-octonorm" value={octonorm} onChange={(e) => setOctonorm(e.target.value)} maxLength={12} className="font-mono" />
            </Field>
            <Field label="Building (optional)" htmlFor="ct-building" hint="Only if it is not at an octonorm.">
              <Input id="ct-building" value={building} onChange={(e) => setBuilding(e.target.value)} maxLength={60} />
            </Field>
            <Field label="Room (optional)" htmlFor="ct-room">
              <Input id="ct-room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} />
            </Field>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Type" htmlFor="ct-type">
            <Select id="ct-type" value={type} onChange={(e) => setType(e.target.value as ParticipantType)}>
              {typeChoices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {!kiet && (
            <Field label={startup ? "Startup name" : type === "school" ? "School" : "College"} htmlFor="ct-institution">
              <Input id="ct-institution" value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={200} />
            </Field>
          )}
          {!kiet && !startup && (
            <Field label="City" htmlFor="ct-city">
              <Input id="ct-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
            </Field>
          )}
          {kiet && wildcard && (
            <Field label="KIET department" htmlFor="ct-department" hint="A department team is ranked in its category with the department winners.">
              <Select id="ct-department" value={kietDepartment} onChange={(e) => setKietDepartment(e.target.value)}>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {departmentLabel(d)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {kiet && !wildcard && (
            <p className="text-xs text-muted md:col-span-2 md:self-end">
              KIET teams are added as {departmentLabel(clubDepartment)} teams, which go straight to the Grand Finale. Department teams cannot be added
              now: the finalist list is locked.
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Team name" htmlFor="ct-name">
            <Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Project title" htmlFor="ct-title">
            <Input id="ct-title" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Category" htmlFor="ct-category">
            <Select id="ct-category" value={category} onChange={(e) => setCategory(Number(e.target.value))}>
              <option value={0}>Choose a category</option>
              {categories.map((c) => (
                <option key={c.number} value={c.number}>
                  {c.number}. {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Domain" htmlFor="ct-domain">
            <Select id="ct-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="">Choose a domain</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Abstract" htmlFor="ct-abstract" hint="Optional here." className="md:col-span-2">
            <Textarea id="ct-abstract" rows={3} value={abstract} onChange={(e) => setAbstract(e.target.value)} maxLength={1500} />
          </Field>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-800">{startup ? "Founder" : "Students (the first one leads)"}</p>
          {shown.map((m, i) => (
            <fieldset key={i} className="grid gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line md:grid-cols-6">
              <legend className="sr-only">Student {i + 1}</legend>
              <Field label={i === 0 ? "Leader's email" : "Email"} htmlFor={`ct-email-${i}`} className="md:col-span-2">
                <Input id={`ct-email-${i}`} type="email" value={m.email} onChange={(e) => change(i, { email: e.target.value })} autoComplete="off" />
              </Field>
              <Field label="Full name" htmlFor={`ct-fullname-${i}`} className="md:col-span-2">
                <Input id={`ct-fullname-${i}`} value={m.fullName} onChange={(e) => change(i, { fullName: e.target.value })} />
              </Field>
              <Field label="Mobile" htmlFor={`ct-phone-${i}`} className="md:col-span-2">
                <div className="flex gap-2">
                  <Input id={`ct-phone-${i}`} type="tel" value={m.phone} onChange={(e) => change(i, { phone: e.target.value })} />
                  {i >= 2 && (
                    <Button variant="ghost" size="sm" onClick={() => setMembers((all) => all.filter((_, j) => j !== i))} aria-label={`Remove student ${i + 1}`}>
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  )}
                </div>
              </Field>
              {!startup && (
                <>
                  <Field label={type === "school" ? "Class" : "Year"} htmlFor={`ct-year-${i}`} className="md:col-span-2">
                    <Select id={`ct-year-${i}`} value={m.year} onChange={(e) => change(i, { year: Number(e.target.value) })}>
                      <option value={0}>Choose</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {yearLabel(y, type)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {type !== "school" && (
                    <Field label="Course" htmlFor={`ct-course-${i}`} className="md:col-span-2">
                      <Select id={`ct-course-${i}`} value={m.course} onChange={(e) => change(i, { course: e.target.value })}>
                        <option value="">Choose</option>
                        {courses.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {type !== "school" && (
                    <Field label="Roll number" htmlFor={`ct-roll-${i}`} className="md:col-span-1">
                      <Input id={`ct-roll-${i}`} value={m.rollNumber} onChange={(e) => change(i, { rollNumber: e.target.value })} />
                    </Field>
                  )}
                  {kiet && (!wildcard || kietDepartment === clubDepartment) && (
                    <Field label="Club" htmlFor={`ct-club-${i}`} className="md:col-span-1">
                      <Input id={`ct-club-${i}`} value={m.club} onChange={(e) => change(i, { club: e.target.value })} />
                    </Field>
                  )}
                </>
              )}
            </fieldset>
          ))}
          {!startup && shown.length < max && (
            <Button variant="secondary" size="sm" onClick={() => setMembers((all) => [...all, blank()])}>
              <Plus aria-hidden="true" className="size-4" />
              Add a student
            </Button>
          )}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}
