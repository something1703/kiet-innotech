import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const metadata: Metadata = {
  title: "Login | InnoTech26",
};

export default function LoginPage() {
  // AuthScreen reads ?next= from the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <AuthScreen mode="login" />
    </Suspense>
  );
}
