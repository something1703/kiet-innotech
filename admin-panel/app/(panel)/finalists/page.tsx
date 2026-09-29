import type { Metadata } from "next";
import { FinalistsView } from "@/components/finalists/FinalistsView";

export const metadata: Metadata = { title: "Finalists" };

export default function FinalistsPage() {
  return <FinalistsView />;
}
