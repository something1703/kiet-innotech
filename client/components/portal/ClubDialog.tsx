"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CLUB_NAME_LENGTH } from "@/lib/rules";
import { Button, Field, Input } from "@/components/ui/form";

/** The name of the technical club, asked when a student picks COE KIET / Technical Club KIET as their department. */
export function ClubDialog({ open, initial, onSave, onClose }: { open: boolean; initial: string; onSave: (club: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-0 text-ink shadow-2xl backdrop:bg-navy-950/60 backdrop:backdrop-blur-sm"
    >
      {/* Mounted only while open, so the box always starts from the saved club name. */}
      {open && <ClubForm titleId={titleId} initial={initial} onSave={onSave} onClose={onClose} />}
    </dialog>
  );
}

function ClubForm({ titleId, initial, onSave, onClose }: { titleId: string; initial: string; onSave: (club: string) => void; onClose: () => void }) {
  const inputId = useId();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const club = value.trim().replace(/\s+/g, " ");
    if (club.length < CLUB_NAME_LENGTH.min) return setError("Enter the name of your technical club.");
    onSave(club);
  };

  return (
    // Not a <form>: this dialog sits inside the profile form, and Enter here must save the club, not the profile.
    <div className="p-6 sm:p-8">
      <h2 id={titleId} className="font-display text-xl font-bold">
        Which technical club are you from?
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        COE KIET brings the technical clubs of KIET together. Tell us the name of your club; the organisers of COE see it next to your name.
      </p>
      <Field id={inputId} label="Name of your technical club" error={error} className="mt-5">
        <Input
          id={inputId}
          value={value}
          invalid={!!error}
          maxLength={CLUB_NAME_LENGTH.max}
          autoFocus
          autoComplete="off"
          placeholder="e.g. Robotics Club"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            save();
          }}
        />
      </Field>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>
          Not now
        </Button>
        <Button onClick={save}>Save club</Button>
      </div>
    </div>
  );
}
