import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackView } from "@/components/feedback/FeedbackView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return (
    <Suspense fallback={<Loading label="Loading the feedback" />}>
      <FeedbackView />
    </Suspense>
  );
}
