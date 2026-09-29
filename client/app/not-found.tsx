import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader linkBase="/" />
      <main className="relative overflow-hidden bg-surface">
        <div className="bg-grid-light absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:py-32">
          <p className="font-display text-7xl font-bold text-navy-900/10 sm:text-9xl">404</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">This page does not exist</h1>
          <p className="mt-4 max-w-md text-muted">The link may be broken or the page may have moved. Head back to the home page or your dashboard.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-accent-500/25 transition hover:bg-accent-600">
              <ArrowLeft size={18} aria-hidden="true" />
              Back to home
            </Link>
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full border border-navy-800/15 bg-white px-7 py-3.5 font-semibold text-navy-800 transition hover:border-navy-800">
              My dashboard
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter linkBase="/" />
    </>
  );
}
