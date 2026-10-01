"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { draftKeys } from "@/lib/drafts";
import { accountName } from "@/lib/format";
import { longDate } from "@/lib/format";
import { useRegistrationDates, useRegistrationState } from "@/lib/registration";
import { Notice } from "@/components/ui/form";
import { PageHeading, Panel } from "@/components/portal/PageHeading";
import { ProfileForm } from "@/components/portal/ProfileForm";
import { usePortal } from "@/components/portal/PortalProvider";
import { useAction } from "@/components/portal/useAction";

export default function OnboardingPage() {
  const router = useRouter();
  const { me, refresh } = usePortal();
  const registration = useRegistrationState();
  const { opens, closes } = useRegistrationDates();
  const { run, pending, error } = useAction();

  const save = async (input: Parameters<typeof api.saveProfile>[0]) => {
    const saved = await run(() => api.saveProfile(input));
    if (!saved) return false;
    await refresh();
    router.replace("/dashboard");
    return true;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading eyebrow="Step 1 of 4" title={`Welcome, ${accountName(me.name, me.email).split(" ")[0] || "student"}`}>
        Tell us about yourself. Your team leader will use your email to add you to their team, and these details go on your certificate.
      </PageHeading>

      {registration === "upcoming" && (
        <Notice tone="info" title={`Registration opens on ${longDate(opens)} and closes on ${longDate(closes)}`} className="mb-6">
          You can fill in your profile once registration opens. Please come back then.
        </Notice>
      )}
      {registration === "closed" && (
        <Notice tone="warning" title="Registration has closed" className="mb-6">
          New profiles can no longer be created. Contact the InnoTech help desk if you think this is a mistake.
        </Notice>
      )}

      <Panel>
        <ProfileForm
          email={me.email}
          defaultName={me.name}
          profile={null}
          submitLabel="Save and continue"
          onSubmit={save}
          draftKey={draftKeys.profile(me.email)}
          pending={pending}
          error={error}
        />
      </Panel>
    </div>
  );
}
