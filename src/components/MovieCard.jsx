import { Star, Bookmark, BookmarkCheck, Calendar, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import PosterImage from './PosterImage';

export default function MovieCard({ movie, onDetails }) {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useApp();
  const inList = isInWatchlist(movie.id);

  const hasRating = typeof movie.rating === 'number';
  const votes = Number.isFinite(movie.voteCount) ? movie.voteCount : 0;
  const ratingTitle = hasRating
    ? `TMDB user rating: ${movie.rating.toFixed(1)} out of 10 (${votes.toLocaleString()} votes)`
    : 'Not rated on TMDB yet';

  const handleWatchlist = (e) => {
    e.stopPropagation();
    if (inList) removeFromWatchlist(movie.id);
    else addToWatchlist(movie);
  };

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return; // ignore keys pressed on the inner watchlist button
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDetails(movie);
    }
  };

  const meta = [movie.genre?.[0], movie.languageName].filter(Boolean);

  return (
    <div
      className="group relative bg-cinema-card rounded-xl overflow-hidden border border-cinema-border hover:border-cinema-purple/40 focus-visible:border-cinema-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cinema-purple transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-cinema-purple/10 cursor-pointer animate-fade-in"
      onClick={() => onDetails(movie)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${movie.title}. ${ratingTitle}`}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-cinema-dark">
        <PosterImage
          src={movie.poster}
          alt={`${movie.title} poster`}
          title={movie.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Watchlist button (always visible on touch screens, on hover/focus on desktop) */}
        <button
          onClick={handleWatchlist}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition-all duration-200 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 ${
            inList ? 'bg-cinema-purple text-white' : 'bg-black/50 text-white hover:bg-cinema-purple'
          }`}
          aria-label={inList ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`}
        >
          {inList ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </button>

        {/* TMDB rating badge */}
        <div
          className="absolute top-3 left-3 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2.5 py-1"
          title={ratingTitle}
        >
          <Star size={12} className="text-cinema-gold fill-cinema-gold" aria-hidden="true" />
          <span className="text-white text-xs font-bold">{hasRating ? movie.rating.toFixed(1) : 'NR'}</span>
          <span className="text-[9px] font-semibold uppercase tracking-wide text-cinema-muted">TMDB</span>
        </div>

        {/* Details hint on hover */}
        <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="w-full flex items-center justify-center gap-2 bg-cinema-purple/90 rounded-lg py-2 text-white text-sm font-medium">
            <Info size={14} aria-hidden="true" />
            View Details
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 mb-1.5 group-hover:text-cinema-purple-light transition-colors">
          {movie.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-cinema-muted">
          <Calendar size={11} aria-hidden="true" />
          <span>{movie.year ?? 'TBA'}</span>
          {meta.length > 0 && <span className="w-1 h-1 rounded-full bg-cinema-border" />}
          <span className="truncate">{meta.join(' · ')}</span>
        </div>
      </div>
    </div>
  );
}
