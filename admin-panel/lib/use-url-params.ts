"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type Patch = Record<string, string | number | null | undefined>;

/**
 * Filters, sorting and paging live in the URL query so a filtered view can be shared or reloaded.
 * Any change other than the page itself sends the user back to page 1.
 * Components using this must render inside a <Suspense> boundary (useSearchParams).
 */
export function useUrlParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const update = useCallback(
    (patch: Patch) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (!("page" in patch)) next.delete("page");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  return { params, update, reset };
}

/** Reads an option from the query, ignoring values that are not allowed. */
export function pickParam<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T | undefined {
  const value = params.get(key);
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function intParam(params: URLSearchParams, key: string, min: number, max: number): number | undefined {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}
