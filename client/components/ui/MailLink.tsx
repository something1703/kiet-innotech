import { event } from "@/lib/content";

/** The organisers' email address as a link, for "write to us" lines. */
export function MailLink({ className = "font-semibold text-brand-700 underline underline-offset-2 hover:text-accent-500" }: { className?: string }) {
  return (
    <a href={`mailto:${event.email}`} className={`[overflow-wrap:anywhere] ${className}`}>
      {event.email}
    </a>
  );
}
