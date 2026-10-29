import type { Metadata } from "next";
import { Suspense } from "react";
import { FinaleView } from "@/components/finale/FinaleView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Grand Finale" };

export default function FinalePage() {
  return (
    <Suspense fallback={<Loading label="Loading the Grand Finale" />}>
      <FinaleView />
    </Suspense>
  );
}
