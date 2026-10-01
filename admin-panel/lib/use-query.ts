"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "./api";

type State<T> = { key: string | null; data?: T; dataKey?: string | null; error?: string };

/**
 * Loads data for a key and reloads when the key changes. The previous data stays visible while
 * the next request runs, so tables do not flash. If that request fails, the old data is kept only
 * for a reload of the same key; data for a different key (e.g. other filters) is dropped so it is
 * not mistaken for the new results. Pass a null key to skip loading.
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
    const dataKey = requestKey.slice(0, requestKey.lastIndexOf("#"));
    let cancelled = false;
    fetcherRef.current().then(
      (data) => {
        if (!cancelled) setState({ key: requestKey, data, dataKey });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState((previous) =>
          previous.dataKey === dataKey
            ? { key: requestKey, data: previous.data, dataKey, error: errorMessage(error) }
            : { key: requestKey, error: errorMessage(error) },
        );
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
    setData: (data: T) => setState({ key: requestKey, data, dataKey: key }),
  };
}
