"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, Field, Input, Notice, type ButtonVariant } from "./form";

/** "  Code   Crafters " and "code crafters" count as the same typed text. */
const normalise = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  pending?: boolean;
  error?: string | null;
  /** When set, the confirm button stays disabled until the student types exactly this text (for actions that cannot be undone). */
  typeToConfirm?: string;
  /** What the typed text is, e.g. "team name"; used in the label above the box. */
  typeToConfirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
};

/** A modal confirmation built on the native <dialog>, which handles focus trapping and the Escape key. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmVariant = "primary",
  pending = false,
  error,
  typeToConfirm,
  typeToConfirmLabel = "text",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Several dialogs can be on one page, so each needs its own title id.
  const titleId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const confirmed = typeToConfirm === undefined || normalise(typed) === normalise(typeToConfirm);

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
      onClose={() => {
        // Whatever was typed is forgotten, so the next time the dialog opens it starts empty.
        setTyped("");
        onClose();
      }}
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-0 text-ink shadow-2xl backdrop:bg-navy-950/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 sm:p-8">
        <h2 id={titleId} className="font-display text-xl font-bold">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
        {typeToConfirm !== undefined && (
          <div className="mt-5">
            <Field id={inputId} label={`Type the ${typeToConfirmLabel} to confirm`} hint={<span>Type <strong className="select-all break-words text-ink">{typeToConfirm}</strong> exactly as shown.</span>}>
              <Input
                id={inputId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={pending}
                onKeyDown={(e) => {
                  // Enter must not confirm by accident; only the button does, once the text matches.
                  if (e.key === "Enter") e.preventDefault();
                }}
              />
            </Field>
          </div>
        )}
        {error && (
          <Notice tone="error" className="mt-5">
            {error}
          </Notice>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} pending={pending} disabled={!confirmed}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
