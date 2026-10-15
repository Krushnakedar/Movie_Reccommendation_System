import { useCallback, useEffect, useRef, useState } from 'react';

const EMPTY = { items: [], page: 0, totalPages: 0, totalResults: 0, status: 'idle', error: null };

function mergeUnique(existing, incoming) {
  const seen = new Set(existing.map((m) => m.id));
  return [...existing, ...incoming.filter((m) => !seen.has(m.id))];
}

/**
 * Paged movie list: loads page 1 whenever `deps` change, then appends further pages on `loadMore()`.
 * `fetchPage(page, signal)` must resolve to the backend's page shape
 * `{ page, totalPages, totalResults, results }`.
 */
export function usePagedMovies(fetchPage, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ ...EMPTY, status: enabled ? 'loading' : 'idle' });
  const [more, setMore] = useState({ loading: false, error: null });
  const [attempt, setAttempt] = useState(0);

  const fetchRef = useRef(fetchPage);
  const stateRef = useRef(state);
  const generation = useRef(0); // bumps whenever filters change so late "load more" results are dropped
  const moreBusy = useRef(false);

  useEffect(() => {
    fetchRef.current = fetchPage;
    stateRef.current = state;
  });

  useEffect(() => {
    generation.current += 1;
    moreBusy.current = false;
    setMore({ loading: false, error: null });

    if (!enabled) {
      setState({ ...EMPTY });
      return undefined;
    }

    const controller = new AbortController();
    setState({ ...EMPTY, status: 'loading' });
    fetchRef.current(1, controller.signal).then(
      (res) => {
        if (controller.signal.aborted) return;
        setState({
          items: mergeUnique([], res.results),
          page: res.page,
          totalPages: res.totalPages,
          totalResults: res.totalResults,
          status: 'success',
          error: null,
        });
      },
      (error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        setState({ ...EMPTY, status: 'error', error });
      }
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, attempt]);

  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (current.status !== 'success' || current.page >= current.totalPages || moreBusy.current) return;
    const gen = generation.current;
    moreBusy.current = true;
    setMore({ loading: true, error: null });
    try {
      const res = await fetchRef.current(current.page + 1);
      if (gen !== generation.current) return;
      setState((prev) => ({
        ...prev,
        items: mergeUnique(prev.items, res.results),
        page: res.page,
        totalPages: res.totalPages,
        totalResults: res.totalResults,
      }));
      setMore({ loading: false, error: null });
    } catch (error) {
      if (gen !== generation.current) return;
      setMore({ loading: false, error });
    } finally {
      if (gen === generation.current) moreBusy.current = false;
    }
  }, []);

  return {
    items: state.items,
    status: state.status,
    loading: state.status === 'loading',
    error: state.error,
    page: state.page,
    totalPages: state.totalPages,
    totalResults: state.totalResults,
    hasMore: state.status === 'success' && state.page < state.totalPages,
    loadMore,
    loadingMore: more.loading,
    moreError: more.error,
    retry: () => setAttempt((n) => n + 1),
  };
}
