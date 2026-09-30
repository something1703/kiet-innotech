"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { navLinks } from "@/lib/content";

/** `linkBase` is "/" on pages other than the home page, so section links point back to it. */
export function SiteHeader({ linkBase = "" }: { linkBase?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState("");

  // Add a shadow once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the nav link of the section currently in view.
  useEffect(() => {
    if (linkBase) return; // Other pages have their own sections with the same ids.
    const sections = navLinks
      .map((link) => document.querySelector(link.href))
      .filter((el): el is Element => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(`#${entry.target.id}`);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [linkBase]);

  // Lock page scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? "border-line shadow-[0_8px_30px_-12px_rgb(11_22_51/0.18)]" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3" onClick={closeMenu}>
          <Image
            src="/images/brand/kiet-logo.png"
            alt="KIET Deemed to be University"
            width={624}
            height={269}
            priority
            className="h-8 w-auto sm:h-11"
          />
          <span className="h-8 w-px bg-line sm:h-10" aria-hidden="true" />
          <span className="flex items-center gap-2">
            <Image
              src="/images/brand/innotech-emblem.png"
              alt=""
              width={476}
              height={476}
              priority
              className="h-9 w-9 sm:h-11 sm:w-11"
            />
            <span className="font-display text-lg font-bold leading-none text-navy-900 sm:text-xl">
              InnoTech<span className="text-brand-500">26</span>
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={`${linkBase}${link.href}`}
                  className={`relative rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:text-accent-500 ${
                    activeId === link.href ? "text-accent-500" : "text-navy-800"
                  }`}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full border border-navy-800/15 px-5 py-2.5 text-sm font-semibold text-navy-800 transition hover:border-navy-800 sm:inline-flex"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="hidden rounded-full bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition hover:-translate-y-0.5 hover:bg-accent-600 sm:inline-flex"
          >
            Register
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-navy-800 transition hover:bg-surface xl:hidden"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile and tablet menu */}
      <div
        id="mobile-menu"
        className={`overflow-hidden border-t border-line bg-white transition-[max-height,opacity] duration-300 xl:hidden ${
          menuOpen ? "max-h-[calc(100vh-4rem)] opacity-100" : "max-h-0 border-transparent opacity-0"
        }`}
      >
        <nav aria-label="Mobile" className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <ul className="grid gap-1 sm:grid-cols-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={`${linkBase}${link.href}`}
                  onClick={closeMenu}
                  className="block rounded-xl px-4 py-3 text-base font-semibold text-navy-800 transition hover:bg-surface hover:text-accent-500"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <Link
              href="/login"
              onClick={closeMenu}
              className="rounded-full border border-navy-800/15 py-3 text-center text-sm font-semibold text-navy-800"
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={closeMenu}
              className="rounded-full bg-accent-500 py-3 text-center text-sm font-semibold text-white"
            >
              Register
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
