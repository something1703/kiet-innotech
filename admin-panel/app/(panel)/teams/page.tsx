import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamsView } from "@/components/teams/TeamsView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Teams" };

export default function TeamsPage() {
  return (
    <Suspense fallback={<Loading label="Loading teams" />}>
      <TeamsView />
    </Suspense>
  );
}
