"use client";

import { useState, type FormEvent } from "react";
import { GraduationCap, School, University } from "lucide-react";
import { departments } from "@/lib/content";
import {
  KIET_INSTITUTION,
  allowedParticipantTypes,
  collegeCourses,
  collegeYears,
  kietCourses,
  participantTypeLabels,
  profileErrors,
  schoolClasses,
  yearLabel,
} from "@/lib/rules";
import type { ParticipantType, Profile, ProfileInput } from "@/lib/types";
import { Button, Field, Input, Notice, Select } from "@/components/ui/form";

const typeIcons = { kiet: University, college: GraduationCap, school: School };
const typeNotes: Record<ParticipantType, string> = {
  kiet: "Department round, then the Grand Finale",
  college: "Straight to the Grand Finale, any category",
  school: "Straight to the Grand Finale, poster categories",
};

type ProfileFormProps = {
  email: string;
  defaultName: string;
  profile: Profile | null;
  /** In a team, the college or school, department and year can no longer change. */
  lockInstitution?: boolean;
  submitLabel: string;
  onSubmit: (input: ProfileInput) => Promise<unknown>;
  pending: boolean;
  error: string | null;
  onCancel?: () => void;
};

function initialValues(email: string, defaultName: string, profile: Profile | null): ProfileInput {
  if (profile) {
    const { fullName, phone, participantType, institution, city, department, course, year, rollNumber } = profile;
    return { fullName, phone, participantType, institution, city, department, course, year, rollNumber };
  }
  const participantType = allowedParticipantTypes(email)[0];
  return {
    fullName: defaultName,
    phone: "",
    participantType,
    institution: participantType === "kiet" ? KIET_INSTITUTION : "",
    city: "",
    department: null,
    course: "",
    year: 0,
    rollNumber: "",
  };
}

export function ProfileForm({ email, defaultName, profile, lockInstitution = false, submitLabel, onSubmit, pending, error, onCancel }: ProfileFormProps) {
  const [values, setValues] = useState<ProfileInput>(() => initialValues(email, defaultName, profile));
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileInput, string>>>({});
  const [confirmed, setConfirmed] = useState(profile !== null);
  const [confirmError, setConfirmError] = useState(false);

  const types = allowedParticipantTypes(email);
  const type = values.participantType;
  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const chooseType = (next: ParticipantType) => {
    setValues((v) => ({ ...v, participantType: next, course: "", year: 0, institution: next === "kiet" ? KIET_INSTITUTION : "", department: null }));
    setErrors({});
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = profileErrors(values, email);
    setErrors(found);
    setConfirmError(!confirmed);
    if (Object.keys(found).length > 0 || !confirmed) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    await onSubmit(values);
  };

  const institutionLabel = type === "school" ? "School name" : "College name";

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-navy-800">I am a</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["kiet", "college", "school"] as const).map((option) => {
            const Icon = typeIcons[option];
            const allowed = types.includes(option) && !(lockInstitution && option !== type);
            const selected = type === option;
            return (
              <label
                key={option}
                className={`relative flex cursor-pointer gap-3 rounded-2xl border p-4 transition has-focus-visible:ring-4 has-focus-visible:ring-brand-500/30 ${
                  selected ? "border-accent-500 bg-accent-50/60" : "border-line bg-white hover:border-navy-800/30"
                } ${allowed ? "" : "cursor-not-allowed opacity-45"}`}
              >
                <input
                  type="radio"
                  name="participantType"
                  value={option}
                  checked={selected}
                  disabled={!allowed}
                  onChange={() => chooseType(option)}
                  className="sr-only"
                />
                <Icon size={22} className={selected ? "text-accent-500" : "text-muted"} aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-ink">{participantTypeLabels[option]}</span>
                  <span className="mt-0.5 block text-xs text-muted">{typeNotes[option]}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">
          {types.includes("kiet")
            ? "You signed in with a @kiet.edu account, so you are registering as a KIET student."
            : "KIET students must sign in with their @kiet.edu account. This account can register for another college or a school."}
        </p>
        {errors.participantType && <p className="mt-2 text-sm font-medium text-red-700">{errors.participantType}</p>}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="fullName" label="Full name" error={errors.fullName} hint="As it should appear on your certificate.">
          <Input id="fullName" value={values.fullName} invalid={!!errors.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" />
        </Field>
        <Field id="email" label="Email" hint="From your Google account.">
          <Input id="email" value={email} disabled />
        </Field>
        <Field id="phone" label="Mobile number" error={errors.phone} hint="10 digits. Used only for event updates.">
          <Input id="phone" type="tel" inputMode="numeric" value={values.phone} invalid={!!errors.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel-national" placeholder="98XXXXXXXX" />
        </Field>

        {type === "kiet" ? (
          <>
            <Field id="department" label="Department" error={errors.department} hint={lockInstitution ? "Locked while you are in a team." : undefined}>
              <Select id="department" value={values.department ?? ""} invalid={!!errors.department} disabled={lockInstitution} onChange={(e) => set("department", e.target.value || null)}>
                <option value="">Choose department</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="course" label="Course" error={errors.course}>
              <Select id="course" value={values.course} invalid={!!errors.course} onChange={(e) => set("course", e.target.value)}>
                <option value="">Choose course</option>
                {kietCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <YearField values={values} error={errors.year} locked={lockInstitution} onChange={(year) => set("year", year)} />
            <Field id="rollNumber" label="University roll number" error={errors.rollNumber}>
              <Input id="rollNumber" inputMode="numeric" value={values.rollNumber} invalid={!!errors.rollNumber} onChange={(e) => set("rollNumber", e.target.value)} placeholder="e.g. 2300290100012" />
            </Field>
          </>
        ) : (
          <>
            <Field id="institution" label={institutionLabel} error={errors.institution} className="sm:col-span-2" hint={lockInstitution ? "Locked while you are in a team." : "Write the full official name. Your teammates must enter the same name."}>
              <Input id="institution" value={values.institution} invalid={!!errors.institution} disabled={lockInstitution} onChange={(e) => set("institution", e.target.value)} autoComplete="organization" />
            </Field>
            <Field id="city" label="City" error={errors.city}>
              <Input id="city" value={values.city} invalid={!!errors.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
            </Field>
            {type === "college" && (
              <Field id="course" label="Course" error={errors.course}>
                <Select id="course" value={values.course} invalid={!!errors.course} onChange={(e) => set("course", e.target.value)}>
                  <option value="">Choose course</option>
                  {collegeCourses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <YearField values={values} error={errors.year} locked={lockInstitution} onChange={(year) => set("year", year)} />
            {type === "college" ? (
              <Field id="rollNumber" label="Enrolment or roll number" error={errors.rollNumber}>
                <Input id="rollNumber" value={values.rollNumber} invalid={!!errors.rollNumber} onChange={(e) => set("rollNumber", e.target.value)} />
              </Field>
            ) : (
              <Field id="rollNumber" label="School admission number" optional>
                <Input id="rollNumber" value={values.rollNumber} onChange={(e) => set("rollNumber", e.target.value)} />
              </Field>
            )}
          </>
        )}
      </div>

      {!profile && (
        <label className="flex gap-3 text-sm text-navy-800">
          <input
            type="checkbox"
            checked={confirmed}
            aria-invalid={confirmError}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              setConfirmError(false);
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent-500"
          />
          <span>
            I confirm these details are correct and I have read the{" "}
            <a href="/guidelines" target="_blank" className="font-semibold text-accent-600 hover:underline">
              InnoTech&apos;26 guidelines
            </a>
            .{confirmError && <span className="mt-1 block font-medium text-red-700">Please confirm to continue.</span>}
          </span>
        </label>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" pending={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function YearField({ values, error, locked, onChange }: { values: ProfileInput; error?: string; locked: boolean; onChange: (year: number) => void }) {
  const school = values.participantType === "school";
  const options = school ? schoolClasses : collegeYears;
  return (
    <Field id="year" label={school ? "Class" : "Year of study"} error={error} hint={locked ? "Locked while you are in a team." : undefined}>
      <Select id="year" value={values.year || ""} invalid={!!error} disabled={locked} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="">{school ? "Choose class" : "Choose year"}</option>
        {options.map((year) => (
          <option key={year} value={year}>
            {yearLabel(year, values.participantType)}
          </option>
        ))}
      </Select>
    </Field>
  );
}
