import { useEffect, useRef } from 'react';
import { X, Star, Clock, Calendar, Globe, Bookmark, BookmarkCheck, Play, RefreshCw, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { getMovieDetails } from '../services/api';
import PosterImage from './PosterImage';

export default function MovieModal({ movie, onClose }) {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useApp();
  const closeRef = useRef(null);

  // The list item opens the modal instantly; the full record (runtime, cast, director, trailer) loads on top of it.
  const details = useApi((signal) => getMovieDetails(movie.id, signal), [movie?.id], { enabled: Boolean(movie) });

  useEffect(() => {
    if (!movie) return undefined;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [movie, onClose]);

  if (!movie) return null;

  const m = details.data && details.data.id === movie.id ? { ...movie, ...details.data } : movie;
  const inList = isInWatchlist(m.id);
  const hasRating = typeof m.rating === 'number';
  const votes = Number.isFinite(m.voteCount) ? m.voteCount : 0;
  const ratingColor = !hasRating
    ? 'text-cinema-muted'
    : m.rating >= 8
      ? 'text-green-400'
      : m.rating >= 7
        ? 'text-cinema-gold'
        : 'text-orange-400';
  const languageLabel = m.languageName || (m.language ? m.language.toUpperCase() : null);

  const handleWatchlist = () => {
    if (inList) removeFromWatchlist(m.id);
    else addToWatchlist(m);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="movie-modal-title"
    >
      <div
        className="relative bg-cinema-dark border border-cinema-border rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Backdrop */}
        <div className="relative h-56 sm:h-72 overflow-hidden bg-gradient-to-br from-cinema-card to-cinema-black">
          {(m.backdrop || m.poster) && (
            <PosterImage
              src={m.backdrop || m.poster}
              alt={`${m.title} backdrop`}
              showTitle={false}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-cinema-dark via-cinema-dark/40 to-transparent" />
          <button
            ref={closeRef}
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cinema-purple"
            aria-label="Close details"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 pb-6 -mt-12 relative">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Poster */}
            <div className="flex-shrink-0">
              <PosterImage
                src={m.poster}
                alt={`${m.title} poster`}
                title={m.title}
                className="w-32 sm:w-40 aspect-[2/3] object-cover rounded-xl border-2 border-cinema-border shadow-xl"
              />
            </div>

            {/* Info */}
            <div className="flex-1 pt-2 sm:pt-16">
              <h2 id="movie-modal-title" className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {m.title}
              </h2>
              {m.originalTitle && m.originalTitle !== m.title && (
                <p className="text-sm text-cinema-muted mb-1">Original title: {m.originalTitle}</p>
              )}
              {m.tagline && <p className="text-sm italic text-cinema-muted mb-2">{m.tagline}</p>}

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span
                  className={`flex items-center gap-1.5 font-bold text-lg ${ratingColor}`}
                  title="Average of TMDB user votes"
                >
                  <Star size={18} className="fill-current" aria-hidden="true" />
                  {hasRating ? (
                    <>
                      {m.rating.toFixed(1)}
                      <span className="text-xs font-normal text-cinema-muted">
                        /10 TMDB · {votes.toLocaleString()} votes
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-normal">Not rated on TMDB yet</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-cinema-muted text-sm">
                  <Calendar size={14} aria-hidden="true" />
                  {m.year ?? 'TBA'}
                </span>
                {m.duration && (
                  <span className="flex items-center gap-1.5 text-cinema-muted text-sm">
                    <Clock size={14} aria-hidden="true" />
                    {Math.floor(m.duration / 60)}h {m.duration % 60}m
                  </span>
                )}
                {languageLabel && (
                  <span className="flex items-center gap-1.5 text-cinema-muted text-sm">
                    <Globe size={14} aria-hidden="true" />
                    {languageLabel}
                  </span>
                )}
              </div>

              {/* Genres */}
              {m.genre?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {m.genre.map((g) => (
                    <span
                      key={g}
                      className="px-3 py-1 bg-cinema-purple/20 border border-cinema-purple/30 rounded-full text-cinema-purple-light text-xs font-medium"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {m.trailer?.url && (
                  <a
                    href={m.trailer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 bg-cinema-purple hover:bg-cinema-purple-light rounded-xl text-white font-medium transition-all duration-200 hover:scale-105"
                  >
                    <Play size={16} fill="currentColor" aria-hidden="true" />
                    Watch Trailer
                  </a>
                )}
                <button
                  onClick={handleWatchlist}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 border ${
                    inList
                      ? 'bg-cinema-purple/20 border-cinema-purple/40 text-cinema-purple-light'
                      : 'border-cinema-border text-cinema-muted hover:border-cinema-purple/40 hover:text-white'
                  }`}
                >
                  {inList ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  {inList ? 'In Watchlist' : 'Add to Watchlist'}
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-cinema-muted uppercase tracking-wider mb-2">Overview</h3>
            <p className="text-cinema-text leading-relaxed">
              {m.description || 'TMDB has no overview for this title in the selected language.'}
            </p>
          </div>

          {/* Full details: loading / error / director + cast */}
          <div className="mt-6" aria-live="polite">
            {details.loading && (
              <p className="flex items-center gap-2 text-sm text-cinema-muted">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Loading cast, runtime and trailer…
              </p>
            )}
            {details.status === 'error' && (
              <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-orange-400">
                <span>{details.error.message} Cast, runtime and trailer are unavailable.</span>
                <button
                  onClick={details.retry}
                  className="inline-flex items-center gap-1 rounded-lg border border-cinema-border px-3 py-1.5 text-cinema-text hover:border-cinema-purple/50"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            )}
            {details.status === 'success' && (m.director || m.cast?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {m.director && (
                  <div>
                    <h3 className="text-sm font-semibold text-cinema-muted uppercase tracking-wider mb-1">Director</h3>
                    <p className="text-white">{m.director}</p>
                  </div>
                )}
                {m.cast?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-cinema-muted uppercase tracking-wider mb-2">Cast</h3>
                    <div className="flex flex-wrap gap-2">
                      {m.cast.slice(0, 6).map((actor) => (
                        <span key={actor} className="px-2.5 py-1 bg-cinema-card rounded-lg text-cinema-text text-xs">
                          {actor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mt-6 text-[11px] text-cinema-muted">Data and ratings from TMDB.</p>
        </div>
      </div>
    </div>
  );
}
