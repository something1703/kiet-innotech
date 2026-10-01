"use client";

import { useEffect, useRef } from "react";

/** A table checkbox; `indeterminate` shows the "some on this page are ticked" state. */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 cursor-pointer rounded border-line align-middle accent-brand-600 disabled:cursor-not-allowed"
    />
  );
}
