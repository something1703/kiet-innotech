import type { Metadata } from "next";
import { DeskView } from "@/components/desk/DeskView";

export const metadata: Metadata = { title: "Event desk" };

export default function DeskPage() {
  return <DeskView />;
}
