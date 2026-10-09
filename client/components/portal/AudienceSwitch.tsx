"use client";

import { useRef, type KeyboardEvent } from "react";
import { GraduationCap, Rocket } from "lucide-react";

export type Audience = "student" | "startup";

const options = [
  { id: "student" as const, label: "Student", icon: GraduationCap },
  { id: "startup" as const, label: "Startup", icon: Rocket },
];

/**
 * A two-way slider at the top of the profile form: register as a student or as a startup.
 * A radio group underneath, so the arrow keys and screen readers work as they do for any radio buttons.
 */
export function AudienceSwitch({ value, onChange, disabled = false }: { value: Audience; onChange: (next: Audience) => void; disabled?: boolean }) {
  const buttons = useRef<Record<Audience, HTMLButtonElement | null>>({ student: null, startup: null });

  const onKeyDown = (event: KeyboardEvent) => {
    if (disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next: Audience = value === "student" ? "startup" : "student";
    onChange(next);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Register as"
      onKeyDown={onKeyDown}
      className={`relative grid w-full grid-cols-2 rounded-full bg-surface p-1 ring-1 ring-line sm:max-w-sm ${disabled ? "opacity-60" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-md shadow-navy-900/10 ring-1 ring-line transition-transform duration-300 ease-out motion-reduce:transition-none ${
          value === "startup" ? "translate-x-full" : ""
        }`}
      />
      {options.map(({ id, label, icon: Icon }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            ref={(node) => {
              buttons.current[id] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`relative z-10 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed ${
              selected ? "text-accent-600" : "text-muted hover:text-navy-800"
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
