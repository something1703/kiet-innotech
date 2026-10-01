import type { Metadata } from "next";
import { Suspense } from "react";
import { JudgingView } from "@/components/judging/JudgingView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Judging" };

export default function JudgingPage() {
  return (
    <Suspense fallback={<Loading label="Loading judging" />}>
      <JudgingView />
    </Suspense>
  );
}
