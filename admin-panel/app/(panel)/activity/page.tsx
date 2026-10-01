import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityView } from "@/components/activity/ActivityView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <Suspense fallback={<Loading label="Loading activity" />}>
      <ActivityView />
    </Suspense>
  );
}
