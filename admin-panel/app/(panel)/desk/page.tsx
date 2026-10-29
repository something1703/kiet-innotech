import type { Metadata } from "next";
import { DeskView } from "@/components/desk/DeskView";

export const metadata: Metadata = { title: "Registration desk" };

export default function DeskPage() {
  return <DeskView />;
}
