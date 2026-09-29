"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useRegistrationState } from "@/lib/registration";
import { Notice } from "@/components/ui/form";
import { PageHeading, Panel } from "@/components/portal/PageHeading";
import { ProfileForm } from "@/components/portal/ProfileForm";
import { usePortal } from "@/components/portal/PortalProvider";
import { useAction } from "@/components/portal/useAction";

export default function OnboardingPage() {
  const router = useRouter();
  const { me, refresh } = usePortal();
  const registration = useRegistrationState();
  const { run, pending, error } = useAction();

  const save = async (input: Parameters<typeof api.saveProfile>[0]) => {
    const saved = await run(() => api.saveProfile(input));
    if (saved) {
      await refresh();
      router.replace("/dashboard");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading eyebrow="Step 1 of 4" title={`Welcome, ${me.name.split(" ")[0] || "student"}`}>
        Tell us about yourself. Your team leader will use your email to add you to their team, and these details go on your certificate.
      </PageHeading>

      {registration === "upcoming" && (
        <Notice tone="info" title="Registration opens on 3 October 2026" className="mb-6">
          You can fill in your profile once registration opens. Please come back then.
        </Notice>
      )}
      {registration === "closed" && (
        <Notice tone="warning" title="Registration has closed" className="mb-6">
          New profiles can no longer be created. Contact the InnoTech help desk if you think this is a mistake.
        </Notice>
      )}

      <Panel>
        <ProfileForm email={me.email} defaultName={me.name} profile={null} submitLabel="Save and continue" onSubmit={save} pending={pending} error={error} />
      </Panel>
    </div>
  );
}
