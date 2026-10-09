"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { rememberStartupIntent } from "@/lib/startup";
import { useRegistrationState } from "@/lib/registration";

/** Takes someone to register a startup: the sign-in page, or their dashboard if they are already signed in. */
export function StartupCta({ className }: { className: string }) {
  const closed = useRegistrationState() === "closed";
  const signedIn = Boolean(useSession());
  const href = signedIn ? "/dashboard" : closed ? "/login?next=/team" : "/register";
  const label = signedIn ? "Go to your dashboard" : closed ? "View your entry" : "Register your startup";
  return (
    <Link href={href} onClick={rememberStartupIntent} className={className}>
      {label}
      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}
