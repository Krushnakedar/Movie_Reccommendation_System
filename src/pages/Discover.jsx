import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import LoadMoreButton from '../components/LoadMoreButton';
import MovieGrid from '../components/MovieGrid';
import { useApi } from '../hooks/useApi';
import { usePagedMovies } from '../hooks/usePagedMovies';
import { SORT_CHOICES } from '../lib/constants';
import { discoverMovies, getGenres, getPopular, getTopRated, getTrending, getUpcoming } from '../services/api';

const CATEGORIES = [
  { id: 'trending', label: 'Trending', fetch: (page, signal) => getTrending({ window: 'week', page }, signal) },
  { id: 'popular', label: 'Popular', fetch: (page, signal) => getPopular({ page }, signal) },
  { id: 'top-rated', label: 'Top Rated', fetch: (page, signal) => getTopRated({ page }, signal) },
  { id: 'upcoming', label: 'Upcoming', fetch: (page, signal) => getUpcoming({ page }, signal) },
];

const chip = (active) =>
  `px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
    active
      ? 'bg-cinema-purple border-cinema-purple text-white'
      : 'border-cinema-border text-cinema-muted hover:border-cinema-purple/50 hover:text-white'
  }`;

export default function Discover({ onDetails, initialCategory = 'popular' }) {
  const [category, setCategory] = useState(
    CATEGORIES.some((c) => c.id === initialCategory) ? initialCategory : 'popular'
  );
  const [genreId, setGenreId] = useState(null);
  const [sortBy, setSortBy] = useState(SORT_CHOICES[0].value);

  const genres = useApi(() => getGenres(), []);

  // No genre selected: the TMDB list for the chosen category.
  // Genre selected: TMDB discover for that genre, ordered by the chosen sort.
  const fetchPage = (page, signal) =>
    genreId
      ? discoverMovies({ genres: [genreId], sortBy, page }, signal)
      : CATEGORIES.find((c) => c.id === category).fetch(page, signal);

  const movies = usePagedMovies(fetchPage, [category, genreId, sortBy]);

  const genreName = genres.data?.find((g) => g.id === genreId)?.name;
  const heading = genreId
    ? `${genreName || 'Genre'} movies`
    : CATEGORIES.find((c) => c.id === category).label;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Discover Movies</h1>
        <p className="text-cinema-muted">Browse the TMDB catalogue by category and genre.</p>
      </div>

      {/* Category (or sort, once a genre is chosen) */}
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label={genreId ? 'Sort order' : 'Category'}>
        {genreId
          ? SORT_CHOICES.map((s) => (
              <button key={s.value} onClick={() => setSortBy(s.value)} className={chip(sortBy === s.value)}>
                {s.label}
              </button>
            ))
          : CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} className={chip(category === c.id)}>
                {c.label}
              </button>
            ))}
      </div>

      {/* Genres, loaded from TMDB through the backend */}
      <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Genre">
        <button onClick={() => setGenreId(null)} className={chip(genreId === null)}>
          All genres
        </button>
        {genres.loading && <span className="px-2 py-2 text-sm text-cinema-muted">Loading genres…</span>}
        {(genres.data || []).map((g) => (
          <button key={g.id} onClick={() => setGenreId(g.id)} className={chip(genreId === g.id)}>
            {g.name}
          </button>
        ))}
        {genres.status === 'error' && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-orange-400">
            <span>{genres.error.message}</span>
            <button
              onClick={genres.retry}
              className="inline-flex items-center gap-1 rounded-lg border border-cinema-border px-2 py-1 text-cinema-text hover:border-cinema-purple/50"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold text-white mb-2">{heading}</h2>
      {movies.status === 'success' && (
        <p className="text-sm text-cinema-muted">{movies.totalResults.toLocaleString()} movies</p>
      )}

      <MovieGrid
        movies={movies.items}
        loading={movies.loading}
        error={movies.error}
        onRetry={movies.retry}
        onDetails={onDetails}
        emptyMessage={genreId ? 'TMDB has no movies for this genre right now.' : 'TMDB returned no movies for this section right now.'}
      />

      <LoadMoreButton
        hasMore={movies.hasMore}
        loading={movies.loadingMore}
        error={movies.moreError}
        onClick={movies.loadMore}
        page={movies.page}
        totalPages={movies.totalPages}
      />
    </div>
  );
}
