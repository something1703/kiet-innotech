"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useRegistrationState } from "@/lib/registration";

/**
 * The main call to action on the landing page: register until registration closes, then sign in to see your team.
 * Uses the browser's clock; the page is prerendered, so the register link shows until the browser has checked.
 */
export function RegisterCta({ label, className }: { label: string; className: string }) {
  const closed = useRegistrationState() === "closed";
  return (
    <Link href={closed ? "/login?next=/team" : "/register"} className={className}>
      {closed ? "View your team" : label}
      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

/** One line about the registration window, in the past tense once it has closed. */
export function RegistrationNote() {
  return useRegistrationState() === "closed"
    ? "Registration closed on 12 October 2026. Registered students can sign in to see their team and results."
    : "Registrations are open from 3 to 12 October 2026. It is free, and it takes just a few minutes.";
}
