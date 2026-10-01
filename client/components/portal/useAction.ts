"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@/lib/api";
import { usePortalResync } from "./PortalProvider";

/** Runs an API call, tracking whether it is pending and the message to show if it fails. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resync = usePortalResync();

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await action();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
        // 404 or 409: the team or invitation changed elsewhere (deleted, submitted, answered), so reload the page's data.
        if (err instanceof ApiError && (err.status === 404 || err.status === 409)) resync?.();
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [resync],
  );

  return { run, pending, error, setError };
}
