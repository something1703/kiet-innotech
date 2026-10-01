import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamDetail } from "@/components/teams/TeamDetail";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Team" };

/** /teams/view/?id=<team id>. A query parameter, not a dynamic segment, so the static export has one page for every team. */
export default function TeamPage() {
  return (
    <Suspense fallback={<Loading label="Loading team" />}>
      <TeamDetail />
    </Suspense>
  );
}
