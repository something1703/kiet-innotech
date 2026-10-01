"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button, Notice, type ButtonVariant } from "./form";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/** A modal confirmation built on the native <dialog>, which handles focus trapping and the Escape key. */
export function ConfirmDialog({ open, title, children, confirmLabel, confirmVariant = "primary", pending = false, error, onConfirm, onClose }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Several dialogs can be on one page, so each needs its own title id.
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
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-0 text-ink shadow-2xl backdrop:bg-navy-950/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 sm:p-8">
        <h2 id={titleId} className="font-display text-xl font-bold">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
        {error && (
          <Notice tone="error" className="mt-5">
            {error}
          </Notice>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} pending={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
