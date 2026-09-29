"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { participantTypeLabels, yearLabel } from "@/lib/rules";
import type { Profile } from "@/lib/types";
import { Button, Notice } from "@/components/ui/form";
import { PageHeading, Panel } from "@/components/portal/PageHeading";
import { ProfileForm } from "@/components/portal/ProfileForm";
import { usePortal } from "@/components/portal/PortalProvider";
import { useAction } from "@/components/portal/useAction";

export default function ProfilePage() {
  const { me, team, refresh } = usePortal();
  const profile = me.profile!;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const { run, pending, error } = useAction();

  const save = async (input: Parameters<typeof api.saveProfile>[0]) => {
    if (await run(() => api.saveProfile(input))) {
      await refresh();
      setEditing(false);
      setSaved(true);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        eyebrow="Your profile"
        title={profile.fullName}
        actions={
          !editing && (
            <Button variant="outline" size="sm" onClick={() => {
                setEditing(true);
                setSaved(false);
              }}>
              <Pencil size={15} aria-hidden="true" />
              Edit profile
            </Button>
          )
        }
      >
        {participantTypeLabels[profile.participantType]}
        {profile.department ? `, ${profile.department}` : ""}. Registered with {profile.email}.
      </PageHeading>

      {saved && (
        <Notice tone="success" className="mb-6">
          Your profile has been updated.
        </Notice>
      )}

      <Panel>
        {editing ? (
          <>
            {team && (
              <Notice tone="info" className="mb-8">
                You are in team {team.name}, so your college or school, department and year can no longer be changed.
              </Notice>
            )}
            <ProfileForm
              email={me.email}
              defaultName={me.name}
              profile={profile}
              lockInstitution={team !== null}
              submitLabel="Save changes"
              onSubmit={save}
              pending={pending}
              error={error}
              onCancel={() => setEditing(false)}
            />
          </>
        ) : (
          <ProfileDetails profile={profile} />
        )}
      </Panel>
    </div>
  );
}

function ProfileDetails({ profile }: { profile: Profile }) {
  const school = profile.participantType === "school";
  const rows: [string, string][] = [
    ["Full name", profile.fullName],
    ["Email", profile.email],
    ["Mobile number", profile.phone],
    ["Participant type", participantTypeLabels[profile.participantType]],
    [school ? "School" : "College", profile.institution],
    ...(profile.department ? ([["Department", profile.department]] as [string, string][]) : []),
    ["City", profile.city],
    ...(!school ? ([["Course", profile.course]] as [string, string][]) : []),
    [school ? "Class" : "Year", yearLabel(profile.year, profile.participantType)],
    [school ? "Admission number" : "Roll number", profile.rollNumber || "Not given"],
  ];

  return (
    <dl className="divide-y divide-line">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="break-words font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
