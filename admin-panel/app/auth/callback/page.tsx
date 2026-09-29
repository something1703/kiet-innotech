import type { Metadata } from "next";
import { Suspense } from "react";
import { CallbackView } from "@/components/auth/CallbackView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Signing in" };

export default function CallbackPage() {
  return (
    <Suspense fallback={<Loading label="Completing sign-in" />}>
      <CallbackView />
    </Suspense>
  );
}
