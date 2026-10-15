import { useEffect, useRef, useState } from "react";

/**
 * Runs an async fetcher and tracks loading / error / success.
 * Re-runs when `deps` change or when `retry()` is called. Stale responses are ignored.
 *
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fetcher
 * @param {unknown[]} deps
 * @param {{enabled?: boolean}} [options]
 */
export function useApi(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({
    status: enabled ? "loading" : "idle",
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle", data: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: "loading", data: null, error: null });
    fetcherRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setState({ status: "success", data, error: null });
      },
      (error) => {
        if (controller.signal.aborted || error?.name === "AbortError") return;
        setState({ status: "error", data: null, error });
      },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, attempt]);

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    loading: state.status === "loading",
    retry: () => setAttempt((n) => n + 1),
  };
}
