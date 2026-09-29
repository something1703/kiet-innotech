import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-y border-dashed border-line px-4 py-10 text-center">
      <p className="font-display text-base font-semibold text-navy-900">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
