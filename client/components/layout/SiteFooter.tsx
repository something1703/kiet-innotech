import Image from "next/image";
import { Globe, Mail, MapPin, Navigation } from "lucide-react";
import { event, navLinks } from "@/lib/content";

/** `linkBase` is "/" on pages other than the home page, so section links point back to it. */
export function SiteFooter({ linkBase = "" }: { linkBase?: string }) {
  return (
    <footer id="contact" className="relative overflow-hidden bg-navy-950 text-slate-300">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.4fr] lg:px-8">
        <div>
          <Image
            src="/images/brand/innotech-logo.png"
            alt="InnoTech26"
            width={1152}
            height={357}
            className="h-14 w-auto"
          />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">
            {event.theme}. Organised by the {event.organiser}, KIET Deemed to be University.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-brand-400" aria-hidden="true" />
              {event.address}
            </li>
            <li className="flex gap-3">
              <Globe size={18} className="shrink-0 text-brand-400" aria-hidden="true" />
              {event.website}
            </li>
            <li className="flex gap-3">
              <Mail size={18} className="mt-0.5 shrink-0 text-brand-400" aria-hidden="true" />
              <span>
                Questions or requests:{" "}
                <a href={`mailto:${event.email}`} className="font-semibold text-white underline-offset-2 hover:text-brand-400 hover:underline">
                  {event.email}
                </a>
              </span>
            </li>
          </ul>
        </div>

        <nav aria-label="Footer">
          <h2 className="font-display text-base font-bold text-white">Quick links</h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 text-sm">
            {navLinks.map((link) => (
              <li key={link.href}>
                {/* The footer is the Contact section, so its own link opens an email instead of scrolling nowhere. */}
                <a
                  href={link.href === "#contact" ? `mailto:${event.email}` : `${linkBase}${link.href}`}
                  className="transition-colors hover:text-brand-400"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a href="/register" className="transition-colors hover:text-brand-400">Register</a>
            </li>
            <li>
              <a href="/login" className="transition-colors hover:text-brand-400">Login</a>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-2 lg:col-span-1">
          <h2 className="font-display text-base font-bold text-white">Find us</h2>
          <div className="relative mt-5 h-52 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <iframe
              src={event.mapEmbedUrl}
              title="KIET campus location on Google Maps"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full w-full border-0 grayscale-[30%]"
            />
            <a
              href={event.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-accent-600"
            >
              <Navigation size={14} aria-hidden="true" />
              Directions
            </a>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-xs sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <p>Copyright {new Date().getFullYear()} KIET Deemed to be University. All rights reserved.</p>
          <p>Delhi-NCR, Ghaziabad, Uttar Pradesh</p>
        </div>
      </div>
    </footer>
  );
}
