import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginsView } from "@/components/logins/LoginsView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Logins & passwords" };

export default function LoginsPage() {
  return (
    <Suspense fallback={<Loading label="Loading the logins" />}>
      <LoginsView />
    </Suspense>
  );
}
