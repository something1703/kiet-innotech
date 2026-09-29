"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "./api";

type State<T> = { key: string | null; data?: T; error?: string };

/**
 * Loads data for a key and reloads when the key changes. The previous data stays visible while
 * the next request runs, so tables do not flash. Pass a null key to skip loading.
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ key: null });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const requestKey = key === null ? null : `${key}#${nonce}`;

  useEffect(() => {
    if (requestKey === null) return;
    let cancelled = false;
    fetcherRef.current().then(
      (data) => {
        if (!cancelled) setState({ key: requestKey, data });
      },
      (error: unknown) => {
        if (!cancelled) setState((previous) => ({ key: requestKey, data: previous.data, error: errorMessage(error) }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const settled = state.key === requestKey;

  return {
    data: state.data,
    error: settled ? state.error : undefined,
    loading: requestKey !== null && !settled,
    reload,
    /** Replace the data after a mutation that returned the new value. */
    setData: (data: T) => setState({ key: requestKey, data }),
  };
}
