import { useRef, useState } from 'react';
import { ChevronRight, Loader2, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { RATING_OPTIONS } from '../lib/constants';
import {
  INITIAL_VISIBLE,
  PAGE_STEP,
  canLoadMore,
  describeCriteria,
  describeMismatches,
  loadMoreRecommendations,
  runRecommendation,
} from '../lib/recommend';
import { discoverMovies, getGenres, getLanguages } from '../services/api';
import ErrorState from './ErrorState';
import LanguageSelect from './LanguageSelect';
import MovieCard from './MovieCard';

const chip = (active) =>
  `px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
    active
      ? 'bg-cinema-purple border-cinema-purple text-white'
      : 'border-cinema-border text-cinema-muted hover:border-cinema-purple/50 hover:text-white'
  }`;

const fetchDiscover = (query) => discoverMovies(query);

export default function RecommendationWizard({ onDetails }) {
  const genres = useApi(() => getGenres(), []);
  const languages = useApi(() => getLanguages(), []);

  // Form
  const [genreId, setGenreId] = useState(null);
  const [language, setLanguage] = useState('');
  const [minRating, setMinRating] = useState(0);

  // Run state
  const [phase, setPhase] = useState('form'); // 'form' | 'loading' | 'results' | 'error'
  const [criteria, setCriteria] = useState(null); // snapshot of the filters that produced the results
  const [outcome, setOutcome] = useState(null);
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(null);
  const runId = useRef(0); // lets us ignore responses that arrive after "New search"

  const genreName = genres.data?.find((g) => g.id === genreId)?.name;
  const languageName = languages.data?.find((l) => l.code === language)?.name;

  const find = async () => {
    if (!genreId) return;
    const snapshot = { genreId, language, minRating };
    const id = ++runId.current;
    setCriteria(snapshot);
    setPhase('loading');
    setError(null);
    setMoreError(null);
    try {
      const result = await runRecommendation(snapshot, fetchDiscover);
      if (id !== runId.current) return;
      setOutcome(result);
      setVisible(INITIAL_VISIBLE);
      setPhase('results');
    } catch (err) {
      if (id !== runId.current) return;
      setError(err);
      setPhase('error');
    }
  };

  const showMore = async () => {
    const nextVisible = visible + PAGE_STEP;
    // Enough movies are already loaded: just reveal them.
    if (nextVisible <= outcome.movies.length || !canLoadMore(outcome)) {
      setVisible(nextVisible);
      return;
    }
    // Otherwise fetch the next TMDB page first.
    const id = runId.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await loadMoreRecommendations(outcome, criteria, fetchDiscover);
      if (id !== runId.current) return;
      setOutcome(next);
      setVisible(nextVisible);
    } catch (err) {
      if (id !== runId.current) return;
      setMoreError(err);
    } finally {
      if (id === runId.current) setLoadingMore(false);
    }
  };

  const reset = () => {
    runId.current += 1;
    setGenreId(null);
    setLanguage('');
    setMinRating(0);
    setOutcome(null);
    setCriteria(null);
    setError(null);
    setMoreError(null);
    setLoadingMore(false);
    setVisible(INITIAL_VISIBLE);
    setPhase('form');
  };

  // ---- Results / loading / error ------------------------------------------------------------
  if (phase !== 'form') {
    const summary = criteria ? describeCriteria(criteria, { genreName, languageName }) : '';
    const shown = outcome ? outcome.movies.slice(0, visible) : [];
    const canShowMore = outcome && (visible < outcome.movies.length || canLoadMore(outcome));

    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">
              {phase === 'loading' && 'Finding your movies…'}
              {phase === 'error' && 'Something went wrong'}
              {phase === 'results' && outcome.mode === 'exact' && 'Your top matches'}
              {phase === 'results' && outcome.mode === 'fallback' && 'No exact match found'}
              {phase === 'results' && outcome.mode === 'none' && 'No movies found'}
            </h3>
            <p className="mt-1 text-sm text-cinema-muted">{summary}</p>
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-cinema-border px-4 py-2 text-sm text-cinema-muted transition-all hover:border-cinema-purple/40 hover:text-white"
          >
            <RotateCcw size={16} aria-hidden="true" />
            New Search
          </button>
        </div>

        {phase === 'loading' && (
          <div className="flex items-center gap-3 py-12 text-cinema-muted" role="status">
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            Searching the TMDB catalogue…
          </div>
        )}

        {phase === 'error' && (
          <ErrorState compact title="Couldn't get recommendations" message={error?.message} onRetry={find} />
        )}

        {phase === 'results' && outcome.mode === 'none' && (
          <div className="py-12 text-center text-cinema-muted">
            <p className="mb-2 text-lg">TMDB has no movies for {genreName || 'this genre'} right now.</p>
            <p className="text-sm">Try a different genre.</p>
          </div>
        )}

        {phase === 'results' && outcome.mode === 'fallback' && (
          <div
            role="status"
            className="flex gap-3 rounded-xl border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-300"
          >
            <TriangleAlert size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p>
              No {genreName || 'movie'} on TMDB matches all of your filters
              {language || minRating > 0 ? ' (' : ''}
              {language ? `language: ${languageName || language.toUpperCase()}` : ''}
              {language && minRating > 0 ? ', ' : ''}
              {minRating > 0 ? `minimum rating: ${Number(minRating).toFixed(1)}+` : ''}
              {language || minRating > 0 ? ')' : ''}. Showing the highest-rated {genreName || 'movies'} instead — these{' '}
              <strong>do not meet all of your other filters</strong>, as noted under each movie.
            </p>
          </div>
        )}

        {phase === 'results' && shown.length > 0 && (
          <>
            <p className="text-sm text-cinema-muted">
              {outcome.mode === 'exact'
                ? `${outcome.totalMatches.toLocaleString()} movie${outcome.totalMatches === 1 ? '' : 's'} match all your filters, ranked by TMDB rating.`
                : `Ranked by TMDB rating. ${outcome.totalMatches.toLocaleString()} ${genreName || 'genre'} movies on TMDB.`}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {shown.map((movie) => {
                const reasons =
                  outcome.mode === 'fallback' ? describeMismatches(movie, criteria, { languageName }) : [];
                return (
                  <div key={movie.id} className="flex flex-col gap-2">
                    <MovieCard movie={movie} onDetails={onDetails} />
                    {reasons.length > 0 && (
                      <ul className="space-y-0.5 text-xs text-orange-400">
                        {reasons.map((r) => (
                          <li key={r}>✕ {r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            {(canShowMore || moreError) && (
              <div className="flex flex-col items-center gap-3 pt-2">
                {moreError && (
                  <p role="alert" className="text-sm text-orange-400">
                    {moreError.message}
                  </p>
                )}
                <button
                  onClick={showMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-xl border border-cinema-border px-6 py-3 font-medium text-white transition-all duration-200 hover:border-cinema-purple/60 hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
                >
                  {loadingMore && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {loadingMore ? 'Loading…' : moreError ? 'Try again' : 'Show more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ---- Form ---------------------------------------------------------------------------------
  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">Pick a genre</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Genre">
          {genres.loading && <span className="py-2 text-sm text-cinema-muted">Loading genres…</span>}
          {(genres.data || []).map((g) => (
            <button key={g.id} onClick={() => setGenreId(g.id)} aria-pressed={genreId === g.id} className={chip(genreId === g.id)}>
              {g.name}
            </button>
          ))}
        </div>
        {genres.status === 'error' && (
          <ErrorState compact title="Couldn't load genres" message={genres.error.message} onRetry={genres.retry} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-lg font-semibold text-white">Original language</h3>
          <LanguageSelect
            languages={languages.data || []}
            value={language}
            onChange={setLanguage}
            loading={languages.loading}
            error={languages.error}
            onRetry={languages.retry}
          />
        </div>
        <div>
          <h3 className="mb-3 text-lg font-semibold text-white">Minimum rating</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Minimum rating">
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMinRating(opt.value)}
                aria-pressed={minRating === opt.value}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  minRating === opt.value
                    ? 'border-cinema-gold bg-cinema-gold/20 text-cinema-gold'
                    : 'border-cinema-border text-cinema-muted hover:border-cinema-gold/50 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <button
          onClick={find}
          disabled={!genreId}
          className="flex items-center gap-2 rounded-xl bg-cinema-purple px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-cinema-purple-light hover:shadow-lg hover:shadow-cinema-purple/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          <Sparkles size={20} aria-hidden="true" />
          Find My Movies
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        {!genreId && <p className="mt-2 text-sm text-cinema-muted">Choose a genre to continue.</p>}
      </div>
    </div>
  );
}
