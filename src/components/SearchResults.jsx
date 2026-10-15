import { X } from 'lucide-react';
import { usePagedMovies } from '../hooks/usePagedMovies';
import { searchMovies } from '../services/api';
import LoadMoreButton from './LoadMoreButton';
import MovieGrid from './MovieGrid';

/**
 * Live search results from TMDB (via the backend). `query` is the debounced text;
 * `pending` is true while the user is still typing, so a loading state shows instead of stale results.
 */
export default function SearchResults({ query, pending, onDetails, onClear }) {
  const movies = usePagedMovies((page, signal) => searchMovies({ query, page }, signal), [query], {
    enabled: query.length > 0,
  });

  const busy = pending || movies.loading;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div aria-live="polite">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            Search results{query ? ` for “${query}”` : ''}
          </h1>
          {!busy && movies.status === 'success' && (
            <p className="text-sm text-cinema-muted">
              {movies.totalResults.toLocaleString()} movie{movies.totalResults === 1 ? '' : 's'} found on TMDB
            </p>
          )}
          {busy && <p className="text-sm text-cinema-muted">Searching…</p>}
        </div>
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-lg border border-cinema-border px-4 py-2 text-sm text-cinema-muted transition-all hover:border-cinema-purple/40 hover:text-white"
        >
          <X size={14} aria-hidden="true" />
          Clear search
        </button>
      </div>

      <MovieGrid
        movies={movies.items}
        loading={busy}
        error={pending ? null : movies.error}
        onRetry={movies.retry}
        onDetails={onDetails}
        emptyMessage={`No movies found for “${query}”. Check the spelling or try a different title.`}
      />

      {!busy && (
        <LoadMoreButton
          hasMore={movies.hasMore}
          loading={movies.loadingMore}
          error={movies.moreError}
          onClick={movies.loadMore}
          page={movies.page}
          totalPages={movies.totalPages}
        />
      )}
    </div>
  );
}
