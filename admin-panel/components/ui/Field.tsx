import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "block w-full rounded-xl border-0 bg-white text-sm text-ink ring-1 ring-inset ring-line transition placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-navy-800">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${control} h-10 px-3 ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${control} h-10 cursor-pointer px-3 pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} min-h-24 px-3 py-2.5 ${className}`} {...props} />;
}
