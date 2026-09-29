import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, LoaderCircle } from "lucide-react";

type Tone = "error" | "info" | "success" | "warning";

const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  error: { box: "border-red-500 bg-red-50 text-red-800", Icon: CircleAlert },
  info: { box: "border-brand-500 bg-brand-50 text-navy-800", Icon: Info },
  success: { box: "border-emerald-500 bg-emerald-50 text-emerald-900", Icon: CircleCheck },
  warning: { box: "border-accent-500 bg-accent-50 text-navy-900", Icon: CircleAlert },
};

/** A ruled message bar: errors, confirmations and notes. */
export function Notice({ tone = "info", title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex flex-wrap items-start gap-3 border-l-4 px-4 py-3 text-sm ${box}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-10 text-sm text-muted">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-brand-500" />
      {label}…
    </p>
  );
}
