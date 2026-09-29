import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentsView } from "@/components/students/StudentsView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Students" };

export default function StudentsPage() {
  return (
    <Suspense fallback={<Loading label="Loading students" />}>
      <StudentsView />
    </Suspense>
  );
}
