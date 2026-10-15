import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AppContext = createContext(null);

const WATCHLIST_KEY = 'cinematch.watchlist.v1';

/** Reads the saved watchlist. Anything unexpected (blocked storage, corrupt JSON) just yields an empty list. */
function loadWatchlist() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((m) => m && Number.isInteger(m.id) && m.title) : [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }) {
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch {
      /* storage unavailable: the watchlist still works for this session */
    }
  }, [watchlist]);

  const addToWatchlist = useCallback((movie) => {
    setWatchlist((prev) => (prev.some((m) => m.id === movie.id) ? prev : [...prev, movie]));
  }, []);

  const removeFromWatchlist = useCallback((movieId) => {
    setWatchlist((prev) => prev.filter((m) => m.id !== movieId));
  }, []);

  const isInWatchlist = useCallback((movieId) => watchlist.some((m) => m.id === movieId), [watchlist]);

  const value = useMemo(
    () => ({ watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, searchQuery, setSearchQuery }),
    [watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, searchQuery]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
