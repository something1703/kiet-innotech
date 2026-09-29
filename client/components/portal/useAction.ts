"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@/lib/api";

/** Runs an API call, tracking whether it is pending and the message to show if it fails. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, setError };
}
