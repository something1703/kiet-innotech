import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "@/components/auth/LoginView";
import { Loading } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<Loading label="Loading sign-in" />}>
      <LoginView />
    </Suspense>
  );
}
