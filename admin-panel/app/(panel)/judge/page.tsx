import type { Metadata } from "next";
import { JudgeView } from "@/components/judging/JudgeView";

export const metadata: Metadata = { title: "My judging" };

export default function JudgePage() {
  return <JudgeView />;
}
