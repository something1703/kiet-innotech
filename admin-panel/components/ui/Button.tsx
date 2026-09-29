import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-accent-500 text-white shadow-sm shadow-accent-500/20 hover:bg-accent-600",
  secondary: "bg-white text-navy-800 ring-1 ring-inset ring-line hover:bg-surface hover:ring-navy-800/25",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-navy-800 hover:bg-surface",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-10 px-5 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button while a request runs. */
  pending?: boolean;
};

export function Button({ variant = "primary", size = "md", pending = false, disabled, className = "", children, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "secondary", size = "md", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
