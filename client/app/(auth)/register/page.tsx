import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const metadata: Metadata = {
  title: "Register | InnoTech26",
};

export default function RegisterPage() {
  // AuthScreen reads ?next= from the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <AuthScreen mode="register" />
    </Suspense>
  );
}
