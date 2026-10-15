import MovieCard from './MovieCard';
import SkeletonCard from './SkeletonCard';
import ErrorState from './ErrorState';
import { Film } from 'lucide-react';

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';

export default function MovieGrid({
  movies,
  loading,
  error,
  onRetry,
  onDetails,
  title,
  subtitle,
  emptyMessage,
  skeletonCount = 12,
  compact = false,
}) {
  return (
    <section className={compact ? 'py-2' : 'py-8'}>
      {(title || subtitle) && (
        <div className="mb-6">
          {title && <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">{title}</h2>}
          {subtitle && <p className="text-cinema-muted text-sm">{subtitle}</p>}
        </div>
      )}

      {loading ? (
        <div className={GRID} aria-busy="true" aria-label="Loading movies">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState compact message={error.message} onRetry={onRetry} title="Couldn't load movies" />
      ) : movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-cinema-muted">
          <Film size={48} className="mb-4 opacity-30" aria-hidden="true" />
          <p className="text-lg">{emptyMessage || 'No movies found.'}</p>
        </div>
      ) : (
        <div className={GRID}>
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} onDetails={onDetails} />
          ))}
        </div>
      )}
    </section>
  );
}
