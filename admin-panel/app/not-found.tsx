import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { KietLogo } from "@/components/layout/Brand";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md border-t-4 border-accent-500 bg-white p-6 ring-1 ring-line sm:p-8">
        <KietLogo className="h-9 w-auto" />
        <p className="mt-6 font-mono text-xs font-semibold tracking-wider text-brand-600">404</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy-900">Page not found</h1>
        <p className="mt-2 text-sm text-muted">This address does not match any page in the InnoTech26 admin panel.</p>
        <Link href="/" className={buttonClass("primary", "md", "mt-6")}>
          Go to overview
        </Link>
      </section>
    </main>
  );
}
