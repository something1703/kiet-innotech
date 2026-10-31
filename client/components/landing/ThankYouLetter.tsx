"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Award, CheckCircle2, Heart, MessageSquareHeart, Star } from "lucide-react";
import { getSession, useSession } from "@/lib/auth/session";
import { portalClosesLabel } from "@/lib/content";
import { sendFeedback, type FeedbackRole } from "@/lib/feedback";

const COLORS = ["#e85524", "#292b38", "#fbbf24", "#f7a07a", "#a3a6b8"];
// Fixed, not random, so server and browser render the same: 28 pieces thrown up and out of the envelope.
const PIECES = Array.from({ length: 28 }, (_, i) => {
  const angle = -Math.PI / 2 + ((i / 27) - 0.5) * Math.PI * 1.5;
  const reach = 150 + (i % 4) * 40;
  return {
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach * 0.9 + 40),
    rotate: (i % 2 ? 1 : -1) * (180 + i * 19),
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
    delay: (i % 7) * 30,
  };
});
const SPARKLES = [
  { left: "4%", top: "10%", delay: "0s", size: 16 },
  { left: "92%", top: "4%", delay: "0.8s", size: 20 },
  { left: "96%", top: "70%", delay: "1.6s", size: 14 },
  { left: "-2%", top: "72%", delay: "1.1s", size: 18 },
  { left: "48%", top: "-6%", delay: "2.1s", size: 14 },
];

/**
 * The home page after the Grand Finale: a sealed letter from the departments that hosted InnoTech'26. It floats until it is
 * tapped; the seal breaks, the flap opens with a burst of confetti and the letter slides out, with the dates to remember,
 * a way to the certificates, and a feedback form. Motion stops for visitors who prefer less of it (globals.css).
 */
export function ThankYouLetter() {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);

  return (
    <section id="thank-you" aria-labelledby="thank-you-title" className="relative overflow-hidden bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 py-14 text-white sm:py-20">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,rgb(232_85_36/0.35),transparent_45%),radial-gradient(circle_at_80%_70%,rgb(251_191_36/0.25),transparent_40%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-amber-300">InnoTech&apos;26 · Grand Finale · 30 October 2026</p>
        <h2 id="thank-you-title" className="mt-3 text-center font-display text-3xl font-bold sm:text-5xl">
          A letter for you
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-white/75 sm:text-base">
          {open ? "From the hosts of InnoTech'26, with gratitude." : "Something arrived after the Grand Finale. Tap the seal to open it."}
        </p>

        <div className="relative mx-auto mt-10 w-full max-w-xl [perspective:1400px]">
          {/* The envelope: floats and sparkles while sealed. */}
          <div className={`relative ${open ? "" : "motion-safe:animate-float"}`}>
            {!open &&
              SPARKLES.map((s, i) => (
                <svg
                  key={i}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="animate-twinkle pointer-events-none absolute z-30 text-amber-300"
                  style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
                  fill="currentColor"
                >
                  <path d="M12 0c.9 6.2 5.8 11.1 12 12-6.2.9-11.1 5.8-12 12-.9-6.2-5.8-11.1-12-12C6.2 11.1 11.1 6.2 12 0Z" />
                </svg>
              ))}

            <div className="relative aspect-[3/2] w-full">
              {/* Back of the envelope */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#f6e7cf] to-[#e9d1ad] shadow-2xl shadow-black/40" />
              {/* The letter inside: rises out when opened */}
              <div
                className={`absolute inset-x-[6%] top-[40%] z-10 h-[56%] rounded-xl bg-white shadow-lg transition-transform duration-[900ms] ease-out ${
                  open ? "-translate-y-[92%] delay-300" : "translate-y-0"
                }`}
                aria-hidden="true"
              >
                <div className="p-4 text-center sm:p-6">
                  <p className="font-display text-2xl font-bold text-accent-600 sm:text-4xl">Thank you!</p>
                  <p className="mt-1 text-xs font-semibold text-navy-800 sm:text-sm">for making InnoTech&apos;26 a grand success</p>
                  <div className="mx-auto mt-3 h-1.5 w-1/3 rounded-full bg-amber-300" />
                </div>
              </div>
              {/* Side flaps: with the pocket they hide the letter until it rises out */}
              <div className="absolute inset-0 z-20 rounded-2xl bg-gradient-to-r from-[#efd6ae] to-[#e6c9a0] [clip-path:polygon(0_0,54%_56%,0_100%)]" />
              <div className="absolute inset-0 z-20 rounded-2xl bg-gradient-to-l from-[#efd6ae] to-[#e6c9a0] [clip-path:polygon(100%_0,46%_56%,100%_100%)]" />
              {/* Front pocket of the envelope */}
              <div className="absolute inset-0 z-20 rounded-2xl [clip-path:polygon(0_38%,50%_72%,100%_38%,100%_100%,0_100%)] bg-gradient-to-br from-[#f3dcb9] to-[#e2c497]" />
              <div className="absolute inset-0 z-20 rounded-2xl [clip-path:polygon(0_100%,50%_64%,100%_100%)] bg-[#dcb989]/70" />
              {/* The flap: swings open */}
              <div
                className={`absolute inset-x-0 top-0 z-[25] h-[76%] origin-top transition-transform duration-700 ease-in-out [backface-visibility:hidden] ${
                  open ? "[transform:rotateX(180deg)]" : "[transform:rotateX(0deg)]"
                }`}
              >
                <div className="h-full w-full rounded-t-2xl bg-gradient-to-b from-[#ecd2a8] to-[#dfbd8a] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
              </div>
              {/* The wax seal */}
              <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={open}
                aria-label="Open the letter"
                className={`absolute left-1/2 top-[56%] z-30 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-accent-500 to-[#a8321a] font-display text-sm font-bold tracking-wider text-white shadow-xl ring-4 ring-[#a8321a]/40 transition duration-500 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-amber-300 sm:size-24 sm:text-base ${
                  open ? "scale-0 rotate-45 opacity-0" : "motion-safe:animate-pulse-ring hover:scale-110"
                }`}
              >
                KIET
              </button>
              {/* Confetti when it opens */}
              {open && (
                <span className="pointer-events-none absolute left-1/2 top-1/3 z-40" aria-hidden="true">
                  {PIECES.map((p, i) => (
                    <span
                      key={i}
                      className="animate-confetti absolute block"
                      style={
                        {
                          "--dx": `${p.dx}px`,
                          "--dy": `${p.dy}px`,
                          "--rot": `${p.rotate}deg`,
                          width: p.round ? 10 : 8,
                          height: p.round ? 10 : 15,
                          borderRadius: p.round ? 9999 : 2,
                          background: p.color,
                          animationDelay: `${p.delay}ms`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </span>
              )}
            </div>
          </div>
          {!open && <p className="mt-5 text-center text-sm font-semibold text-amber-200 motion-safe:animate-pulse">Tap the seal</p>}
        </div>

        {/* The letter itself */}
        {open && (
          <article className="motion-safe:animate-fade-up relative mx-auto -mt-2 max-w-3xl rounded-3xl bg-[#fffaf2] p-6 text-ink shadow-2xl ring-1 ring-amber-200 sm:p-10">
            <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-accent-600">With gratitude</p>
            <h3 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Dear innovators, mentors, judges and friends,</h3>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-navy-800 sm:text-base">
              <p>
                Thank you for making <strong>InnoTech&apos;26</strong> a grand success. On 30 October the Grand Finale filled G Block and the
                badminton court with ideas: teams from every department of KIET, other colleges, schools, centres of excellence, technical
                clubs and start-ups showed what they had built, and our judges spent the day listening, asking and encouraging.
              </p>
              <p>
                Even the rain could not stop us. Everyone moved indoors with a smile, set up again and kept going. That spirit of building
                together is exactly what InnoTech is about.
              </p>
              <p>
                To every team: whether you took home a prize or not, you built something real and shared it with the world. We are proud of
                you. To the judges, faculty, volunteers and the registration desk: thank you for your time and care. To our sponsors and
                guests: thank you for believing in our students.
              </p>
              <p>We were very happy to host you. See you at InnoTech&apos;27!</p>
            </div>
            <p className="mt-6 font-display text-base font-bold text-ink">
              Department of Information Technology
              <br />
              Department of Computer Science and Engineering (Cyber Security)
              <span className="mt-1 block text-sm font-semibold text-muted">KIET Deemed to be University, Delhi-NCR, Ghaziabad</span>
            </p>

            <div className="mt-7 rounded-2xl bg-white p-4 ring-1 ring-amber-200 sm:p-5">
              <p className="flex items-start gap-2 text-sm font-semibold text-ink">
                <Award aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-600" />
                The InnoTech&apos;26 portal stays open until {portalClosesLabel}. Download your certificates before it closes.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/certificates" className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-accent-600">
                  <Award aria-hidden="true" className="size-4" />
                  Get my certificate
                </Link>
                <button
                  type="button"
                  onClick={() => setWriting(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
                >
                  <MessageSquareHeart aria-hidden="true" className="size-4" />
                  Share your feedback
                </button>
              </div>
            </div>
            {writing && <FeedbackForm />}
          </article>
        )}
      </div>
    </section>
  );
}

const ROLES: { value: FeedbackRole; label: string }[] = [
  { value: "student", label: "Participant (student)" },
  { value: "judge", label: "Judge" },
  { value: "faculty", label: "Faculty or volunteer" },
  { value: "parent", label: "Parent" },
  { value: "guest", label: "Visitor or guest" },
  { value: "other", label: "Someone else" },
];
const RATINGS = ["Poor", "Fair", "Good", "Very good", "Excellent"];
const field = "mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20";

/** A short feedback form: a rating, what went well, what could be better. A signed-in student's details come from their account. */
function FeedbackForm() {
  const session = useSession();
  const [rating, setRating] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "guest" as FeedbackRole, institution: "", liked: "", improve: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Please choose a rating.");
    if (!session && (form.name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))) {
      return setError("Please give your name and a valid email.");
    }
    setPending(true);
    setError(null);
    try {
      await sendFeedback({ ...form, rating }, getSession()?.token);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your feedback. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="motion-safe:animate-fade-up mt-6 flex items-start gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-900 ring-1 ring-emerald-200">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-display text-lg font-bold">Thank you for your feedback!</p>
          <p className="text-sm">It reaches the organisers directly and helps us make InnoTech&apos;27 even better.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="motion-safe:animate-fade-up mt-6 space-y-4 rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6" aria-labelledby="feedback-title" noValidate>
      <h4 id="feedback-title" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Heart aria-hidden="true" className="size-5 text-accent-500" />
        How was InnoTech&apos;26?
      </h4>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Your rating</legend>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} of 5: ${RATINGS[n - 1]}`}
              aria-pressed={rating === n}
              className="rounded-lg p-1 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-accent-500"
            >
              <Star aria-hidden="true" className={`size-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-line"}`} />
            </button>
          ))}
          {rating > 0 && <span className="ml-2 text-sm font-semibold text-accent-600">{RATINGS[rating - 1]}</span>}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold text-ink">
        What did you enjoy?
        <textarea rows={3} maxLength={2000} value={form.liked} onChange={set("liked")} className={field} placeholder="The projects, the judges, the energy..." />
      </label>
      <label className="block text-sm font-semibold text-ink">
        What could we do better next time?
        <textarea rows={3} maxLength={2000} value={form.improve} onChange={set("improve")} className={field} placeholder="Anything that would make InnoTech'27 even better" />
      </label>
      {session ? (
        <p className="text-sm text-muted">
          Sending as <strong className="text-ink">{session.email}</strong>. Your name and team come from your InnoTech account.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-ink">
            Your name
            <input required maxLength={120} value={form.name} onChange={set("name")} className={field} autoComplete="name" />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Email
            <input required type="email" maxLength={320} value={form.email} onChange={set("email")} className={field} autoComplete="email" />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Phone <span className="font-normal text-muted">(optional)</span>
            <input type="tel" maxLength={20} value={form.phone} onChange={set("phone")} className={field} autoComplete="tel" />
          </label>
          <label className="block text-sm font-semibold text-ink">
            You are a
            <select value={form.role} onChange={set("role")} className={field}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink sm:col-span-2">
            College, school or organisation <span className="font-normal text-muted">(optional)</span>
            <input maxLength={200} value={form.institution} onChange={set("institution")} className={field} autoComplete="organization" />
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-accent-600 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
