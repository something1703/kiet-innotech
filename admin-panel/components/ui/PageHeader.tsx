import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** A section title with a rule under it, used between blocks on a page. */
export function SectionTitle({ title, meta, id }: { title: string; meta?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="font-display text-lg font-bold text-navy-900">
        {title}
      </h2>
      {meta && <div className="text-xs text-muted">{meta}</div>}
    </div>
  );
}
