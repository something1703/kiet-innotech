"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Rows ticked in a table, kept across pages and filter changes until cleared, so an admin can pick rows from
 * several pages and export just those. Stores the rows themselves, so exporting them needs no extra request.
 */
export function useSelection<T>(keyOf: (row: T) => string) {
  const [selected, setSelected] = useState<Map<string, T>>(() => new Map());

  const toggle = useCallback(
    (row: T) =>
      setSelected((previous) => {
        const next = new Map(previous);
        if (next.has(keyOf(row))) next.delete(keyOf(row));
        else next.set(keyOf(row), row);
        return next;
      }),
    [keyOf],
  );

  /** Ticks (or unticks) all of `rows`, leaving other selected rows alone. */
  const setMany = useCallback(
    (rows: T[], on: boolean) =>
      setSelected((previous) => {
        const next = new Map(previous);
        for (const row of rows) {
          if (on) next.set(keyOf(row), row);
          else next.delete(keyOf(row));
        }
        return next;
      }),
    [keyOf],
  );

  const replace = useCallback((rows: T[]) => setSelected(new Map(rows.map((row) => [keyOf(row), row]))), [keyOf]);
  const clear = useCallback(() => setSelected(new Map()), []);
  const rows = useMemo(() => [...selected.values()], [selected]);

  return { size: selected.size, has: (row: T) => selected.has(keyOf(row)), rows, toggle, setMany, replace, clear };
}
