import type { Metadata } from "next";
import { TeamDetail } from "@/components/teams/TeamDetail";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return <TeamDetail />;
}
