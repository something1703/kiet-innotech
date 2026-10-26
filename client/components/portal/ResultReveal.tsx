"use client";

import { useEffect, useRef, useState } from "react";
import { ordinal } from "@/lib/ordinal";
import { Award, Download, Medal, RotateCcw, Rocket, Trophy, Volume2, VolumeX, X } from "lucide-react";

export type RevealKind = "first" | "second" | "third";

export type RevealResult = {
  kind: RevealKind;
  studentName: string;
  /** 1 for 1st, 2 for 2nd, 3 for 3rd and so on: the medal text and the colours follow it. */
  place: number;
  teamName: string;
  teamCode: string;
  department: string;
  category: number;
  categoryTitle: string;
  /** Cash prize; the department round pays the 1st place only. */
  amount: number | null;
};

type Phase = "sealed" | "drumroll" | "revealed";

const LOOK = {
  first: {
    medal: "from-amber-200 via-amber-400 to-amber-600",
    ring: "ring-amber-200/70",
    glow: "rgba(251, 191, 36, 0.55)",
    ray: "rgba(253, 224, 71, 0.16)",
    eyebrow: "text-amber-300",
    confetti: ["#fbbf24", "#f59e0b", "#fde68a", "#e85524", "#ffffff", "#f07a48"],
    place: "1st",
    title: "Department winner",
  },
  second: {
    medal: "from-slate-100 via-slate-300 to-slate-500",
    ring: "ring-slate-200/70",
    glow: "rgba(203, 213, 225, 0.5)",
    ray: "rgba(226, 232, 240, 0.14)",
    eyebrow: "text-slate-200",
    confetti: ["#e2e8f0", "#cbd5e1", "#94a3b8", "#e85524", "#ffffff", "#f7a07a"],
    place: "2nd",
    title: "Department winner",
  },
  third: {
    medal: "from-amber-500 via-orange-500 to-amber-800",
    ring: "ring-orange-300/60",
    glow: "rgba(234, 120, 40, 0.5)",
    ray: "rgba(251, 146, 60, 0.15)",
    eyebrow: "text-orange-300",
    confetti: ["#fb923c", "#ea580c", "#fdba74", "#e85524", "#ffffff", "#fbbf24"],
    place: "3rd",
    title: "Department winner",
  },
} as const;

/**
 * The moment a winning team learns it won: a sealed card they tap to open (the tap also lets the browser play sound), a
 * drumroll, then the reveal with a medal, light rays, confetti, a cymbal and a fanfare, and the note that their Grand Finale
 * details follow. Winners only: everyone else just gets their result card and certificate on the dashboard. Sound is made in the
 * browser (no files) and can be muted; with reduced motion the page skips the movement and goes straight to the result.
 */
export function ResultReveal({
  result,
  onClose,
  onDownload,
  downloadNote,
}: {
  result: RevealResult;
  onClose: () => void;
  /** Saves the certificate. Leave it out when this student has none (not marked present): the button is not shown. */
  onDownload?: () => void | Promise<void>;
  /** Shown instead of the button when there is no certificate. */
  downloadNote?: string;
}) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [muted, setMuted] = useState(false);
  const [burst, setBurst] = useState(0);
  const sound = useRef<Sound | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      sound.current?.close();
    };
  }, []);

  function later(ms: number, run: () => void) {
    timers.current.push(window.setTimeout(run, ms));
  }

  function reveal() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    sound.current ??= new Sound();
    sound.current.setMuted(muted);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const roll = still ? 0 : 2400;
    setPhase(still ? "revealed" : "drumroll");
    if (!still) sound.current.drumroll(roll / 1000);
    later(roll, () => {
      setPhase("revealed");
      sound.current?.crash();
      sound.current?.fanfare(result.kind === "first");
      if (!still) setBurst((n) => n + 1);
    });
    if (!still) later(roll + 1300, () => setBurst((n) => n + 1));
  }

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    sound.current?.setMuted(next);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Your department round result" className="fixed inset-0 z-50 overflow-y-auto bg-navy-950 text-white">
      <style>{KEYFRAMES}</style>
      {/* The stage: a spotlight that tightens during the drumroll and opens up on the reveal. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 transition-[background] duration-[1200ms] ease-out"
        style={{
          background:
            phase === "sealed"
              ? "radial-gradient(60% 45% at 50% 40%, rgba(232,85,36,0.18), transparent 70%)"
              : phase === "drumroll"
                ? "radial-gradient(28% 22% at 50% 42%, rgba(255,255,255,0.16), transparent 75%)"
                : `radial-gradient(70% 55% at 50% 38%, ${LOOK[result.kind].glow}, transparent 72%)`,
        }}
      />
      <Confetti burst={burst} colors={LOOK[result.kind].confetti} />

      <div className="fixed right-3 top-3 z-20 flex gap-2 sm:right-5 sm:top-5">
        <button type="button" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Turn sound off"} className={iconButton}>
          {muted ? <VolumeX className="size-5" aria-hidden="true" /> : <Volume2 className="size-5" aria-hidden="true" />}
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className={iconButton}>
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative z-10 mx-auto flex min-h-full max-w-xl flex-col items-center justify-center px-5 py-14 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">InnoTech&apos;26 · Department round</p>

        {phase === "sealed" && (
          <div className="rr-rise mt-8 flex w-full flex-col items-center">
            <div className="rr-float relative w-full max-w-sm rounded-[2rem] bg-gradient-to-br from-navy-800 to-navy-900 p-8 shadow-2xl ring-1 ring-white/10">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent" />
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-500/15 ring-1 ring-brand-400/40">
                <Award className="size-8 text-brand-300" aria-hidden="true" />
              </span>
              <h1 className="mt-5 font-display text-2xl font-bold">Your result is in</h1>
              <p className="mt-2 text-sm text-white/70">
                {result.teamName} · {result.department} · PS {result.category}
              </p>
            </div>
            <button type="button" onClick={reveal} className="rr-pulse mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-brand-500 px-8 font-display text-lg font-bold shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              Tap to reveal
            </button>
            <p className="mt-3 text-xs text-white/50">Turn your sound on</p>
          </div>
        )}

        {phase === "drumroll" && (
          <div className="mt-10 flex flex-col items-center" aria-live="polite">
            <div className="rr-shake flex size-40 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15">
              <Trophy className="size-16 text-white/40" aria-hidden="true" />
            </div>
            <p className="rr-blink mt-8 font-display text-xl font-semibold text-white/80">And the result is…</p>
          </div>
        )}

        {phase === "revealed" && <Winner result={result} />}

        {phase === "revealed" && !onDownload && downloadNote && (
          <p className="rr-rise mt-8 max-w-sm text-sm text-white/65" style={{ animationDelay: "1.4s" }}>
            {downloadNote}
          </p>
        )}

        {phase === "revealed" && (
          <div className="rr-rise mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "1.4s" }}>
            {onDownload && (
              <button type="button" onClick={() => void onDownload()} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-navy-900 shadow-lg transition hover:bg-brand-50">
                <Download className="size-4" aria-hidden="true" />
                Download winner certificate
              </button>
            )}
            <button type="button" onClick={reveal} className="inline-flex h-12 items-center gap-2 rounded-full px-5 font-semibold text-white/80 ring-1 ring-white/20 transition hover:bg-white/10">
              <RotateCcw className="size-4" aria-hidden="true" />
              Replay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Winner({ result }: { result: RevealResult }) {
  const look = LOOK[result.kind];
  return (
    <div className="mt-6 flex flex-col items-center [text-shadow:0_2px_14px_rgba(0,0,0,0.75)]" aria-live="polite">
      <div className="relative flex size-48 items-center justify-center sm:size-72">
        {/* Light rays turning slowly behind the medal. */}
        <div
          aria-hidden="true"
          className="rr-spin absolute inset-[-40%] rounded-full"
          style={{ background: `repeating-conic-gradient(${look.ray} 0deg 8deg, transparent 8deg 22deg)`, maskImage: "radial-gradient(circle, black 30%, transparent 68%)" }}
        />
        <div className={`rr-medal relative flex size-36 flex-col items-center justify-center rounded-full bg-gradient-to-br ${look.medal} shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] ring-8 ${look.ring} sm:size-48`}>
          <div className="absolute inset-3 rounded-full ring-2 ring-white/40" />
          <span className="rr-shine absolute inset-0 overflow-hidden rounded-full" aria-hidden="true" />
          <Medal className="size-10 text-navy-900/70" aria-hidden="true" />
          <span className="font-display text-4xl font-black leading-none text-navy-900 sm:text-5xl">{ordinal(result.place)}</span>
          <span className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-navy-900/70">Place</span>
        </div>
      </div>
      <p className={`rr-rise text-sm font-bold uppercase tracking-[0.25em] ${look.eyebrow}`} style={{ animationDelay: "0.5s" }}>
        {look.title} · {result.department}
      </p>
      <h1 className="rr-rise mt-3 font-display text-3xl font-bold sm:text-4xl" style={{ animationDelay: "0.65s" }}>
        Congratulations, {firstName(result.studentName)}!
      </h1>
      <p className="rr-rise mt-3 text-base text-white/80" style={{ animationDelay: "0.8s" }}>
        <span className="font-semibold text-white">{result.teamName}</span> ({result.teamCode}) came {ordinal(result.place)} in PS {result.category}: {result.categoryTitle}.
      </p>
      {result.amount !== null && (
        <div className="rr-rise mt-6 rounded-2xl bg-white/10 px-6 py-4 ring-1 ring-white/15" style={{ animationDelay: "1s" }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Prize</p>
          <CountUp to={result.amount} delay={1000} />
        </div>
      )}
      <p className="rr-rise mt-6 flex max-w-sm items-start gap-3 rounded-2xl bg-brand-500/15 px-4 py-3 text-left text-sm text-white/90 ring-1 ring-brand-400/30" style={{ animationDelay: "1.2s" }}>
        <Rocket className="mt-0.5 size-5 shrink-0 text-brand-300" aria-hidden="true" />
        <span>
          <span className="block font-semibold text-white">Grand Finale · 30 October</span>
          Your Grand Finale details will be shared with you soon. Watch this page and your email.
        </span>
      </p>
    </div>
  );
}

/** The prize counting up, written straight into the element so it does not re-render the page 60 times a second. */
function CountUp({ to, delay }: { to: number; delay: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1400));
      const eased = 1 - Math.pow(1 - t, 3);
      if (ref.current) ref.current.textContent = `₹${Math.round(to * eased).toLocaleString("en-IN")}`;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delay]);
  return (
    <p ref={ref} className="font-display text-4xl font-black tabular-nums">
      ₹0
    </p>
  );
}

/** Confetti on a canvas over the whole stage. Each new `burst` fires another round from both sides and the top. */
function Confetti({ burst, colors }: { burst: number; colors: readonly string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || burst === 0) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const scale = window.devicePixelRatio || 1;
    const resize = () => {
      el.width = innerWidth * scale;
      el.height = innerHeight * scale;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    resize();
    const w = innerWidth;
    const h = innerHeight;
    type Bit = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; c: string; round: boolean };
    const bits: Bit[] = [];
    const add = (x: number, y: number, angle: number, spread: number, speed: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const v = speed * (0.6 + Math.random() * 0.6);
        bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, s: 6 + Math.random() * 7, c: colors[i % colors.length], round: Math.random() < 0.25 });
      }
    };
    // The first burst is the big one; later ones come from the sides only, so the text stays readable.
    const big = burst === 1;
    add(0, h * 0.75, -Math.PI / 3, 0.9, 17, big ? 110 : 45);
    add(w, h * 0.75, (-2 * Math.PI) / 3, 0.9, 17, big ? 110 : 45);
    if (big) add(w / 2, -20, Math.PI / 2, 2.2, 4, 70);
    let frame = 0;
    const step = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const b of bits) {
        b.vy += 0.28;
        b.vx *= 0.99;
        b.vy *= 0.99;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        if (b.y > h + 40) continue;
        alive++;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        if (b.round) {
          ctx.beginPath();
          ctx.arc(0, 0, b.s / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2 * Math.abs(Math.cos(b.r * 2)) + 1);
        }
        ctx.restore();
      }
      if (alive > 0) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, w, h);
    };
  }, [burst, colors]);
  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[5] size-full" />;
}

/** All the sound, made with the Web Audio API: a snare drumroll, a cymbal, and a brass fanfare. */
class Sound {
  private ctx = new AudioContext();
  private master: GainNode;

  constructor() {
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    const limiter = this.ctx.createDynamicsCompressor();
    this.master.connect(limiter).connect(this.ctx.destination);
    void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  close() {
    void this.ctx.close();
  }

  private noise(seconds: number) {
    const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  /** A snare roll that speeds up and swells, ending in one accent. */
  drumroll(seconds: number) {
    const t0 = this.ctx.currentTime + 0.05;
    let t = t0;
    while (t < t0 + seconds) {
      const p = (t - t0) / seconds;
      const hit = this.noise(0.08);
      const band = this.ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 1800 + p * 900;
      band.Q.value = 0.8;
      const g = this.ctx.createGain();
      const peak = 0.06 + p * p * 0.5;
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      hit.connect(band).connect(g).connect(this.master);
      hit.start(t);
      hit.stop(t + 0.08);
      t += 0.075 - p * 0.035;
    }
    // A low timpani swell under the roll.
    const boom = this.ctx.createOscillator();
    boom.type = "sine";
    boom.frequency.setValueAtTime(70, t0);
    boom.frequency.linearRampToValueAtTime(95, t0 + seconds);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.exponentialRampToValueAtTime(0.35, t0 + seconds);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds + 0.3);
    boom.connect(bg).connect(this.master);
    boom.start(t0);
    boom.stop(t0 + seconds + 0.35);
  }

  /** A crash cymbal: bright noise with a long tail. */
  crash() {
    const t = this.ctx.currentTime;
    const src = this.noise(2.6);
    const high = this.ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 4500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    src.connect(high).connect(g).connect(this.master);
    src.start(t);
    // And a kick under it.
    const kick = this.ctx.createOscillator();
    kick.frequency.setValueAtTime(150, t);
    kick.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    const kg = this.ctx.createGain();
    kg.gain.setValueAtTime(0.9, t);
    kg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    kick.connect(kg).connect(this.master);
    kick.start(t);
    kick.stop(t + 0.4);
  }

  /** A brass-like note: detuned saws through a filter that opens on the attack. */
  private brass(freq: number, at: number, length: number, level = 0.16) {
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(level, at + 0.04);
    out.gain.setValueAtTime(level, at + length - 0.08);
    out.gain.exponentialRampToValueAtTime(0.0001, at + length + 0.25);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(600, at);
    filter.frequency.exponentialRampToValueAtTime(3200, at + 0.06);
    filter.frequency.exponentialRampToValueAtTime(1800, at + length);
    filter.connect(out).connect(this.master);
    for (const detune of [-8, 0, 7]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(at);
      osc.stop(at + length + 0.3);
    }
  }

  /** The fanfare: a rising call and a big held chord. 1st place gets the brighter, longer one. */
  fanfare(first: boolean) {
    const t = this.ctx.currentTime + 0.12;
    const n = (semi: number) => 261.63 * Math.pow(2, semi / 12);
    const call = first
      ? [
          [7, 0, 0.14],
          [7, 0.16, 0.14],
          [7, 0.32, 0.14],
          [12, 0.48, 0.5],
          [9, 1.0, 0.2],
          [12, 1.22, 0.2],
        ]
      : [
          [7, 0, 0.16],
          [12, 0.2, 0.4],
          [11, 0.64, 0.18],
          [12, 0.86, 0.2],
        ];
    for (const [semi, at, len] of call) this.brass(n(semi), t + at, len);
    const chordAt = t + (first ? 1.46 : 1.1);
    const chord = first ? [0, 4, 7, 12, 16] : [0, 4, 7, 12];
    for (const semi of chord) this.brass(n(semi), chordAt, first ? 1.8 : 1.4, 0.1);
    this.brass(n(-12), chordAt, first ? 1.8 : 1.4, 0.12);
  }
}

function firstName(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

const iconButton =
  "inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white";

const KEYFRAMES = `
@keyframes rr-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes rr-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes rr-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(232,85,36,0.55); } 70% { box-shadow: 0 0 0 18px rgba(232,85,36,0); } }
@keyframes rr-shake { 0%, 100% { transform: rotate(0) scale(1); } 25% { transform: rotate(-4deg) scale(1.03); } 75% { transform: rotate(4deg) scale(1.03); } }
@keyframes rr-blink { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
@keyframes rr-medal { 0% { opacity: 0; transform: translateY(-120px) scale(0.3) rotate(-200deg); } 60% { opacity: 1; transform: translateY(8px) scale(1.12) rotate(8deg); } 80% { transform: translateY(-4px) scale(0.97) rotate(-3deg); } 100% { transform: none; } }
@keyframes rr-spin { from { transform: rotate(0); opacity: 0; } 15% { opacity: 1; } to { transform: rotate(360deg); opacity: 1; } }
@keyframes rr-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(220%) skewX(-20deg); } }
.rr-rise { opacity: 0; animation: rr-rise 0.7s cubic-bezier(.2,.8,.2,1) forwards; }
.rr-float { animation: rr-float 4s ease-in-out infinite; }
.rr-pulse { animation: rr-pulse 1.8s ease-out infinite; }
.rr-shake { animation: rr-shake 0.18s linear infinite; }
.rr-blink { animation: rr-blink 0.9s ease-in-out infinite; }
.rr-medal { animation: rr-medal 1.1s cubic-bezier(.2,.9,.25,1.1) both; }
.rr-spin { animation: rr-spin 18s linear infinite; }
.rr-shine::after { content: ""; position: absolute; inset: 0; width: 45%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent); animation: rr-shine 1.2s 1.1s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .rr-rise, .rr-float, .rr-pulse, .rr-shake, .rr-blink, .rr-medal, .rr-spin, .rr-shine::after { animation: none !important; opacity: 1 !important; transform: none !important; }
}
`;
