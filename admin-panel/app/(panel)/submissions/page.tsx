import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionsView } from "@/components/submissions/SubmissionsView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Submissions" };

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<Loading label="Loading submissions" />}>
      <SubmissionsView />
    </Suspense>
  );
}
