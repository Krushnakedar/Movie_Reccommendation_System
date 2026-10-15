import { Bookmark } from 'lucide-react';
import { useApp } from '../context/AppContext';
import MockDisclaimer from '../components/MockDisclaimer';
import MovieCard from '../components/MovieCard';

export default function Watchlist({ onDetails, onNavigate }) {
  const { watchlist } = useApp();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <MockDisclaimer />
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">My Watchlist</h1>
        <p className="text-cinema-muted">{watchlist.length} movie{watchlist.length !== 1 ? 's' : ''} saved</p>
      </div>

      {watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-cinema-muted">
          <Bookmark size={64} className="mb-6 opacity-20" />
          <h3 className="text-xl font-semibold text-white mb-2">Your watchlist is empty</h3>
          <p className="text-sm mb-8">Bookmark movies to save them here for later.</p>
          <button
            onClick={() => onNavigate('discover')}
            className="px-6 py-3 bg-cinema-purple hover:bg-cinema-purple-light rounded-xl text-white font-medium transition-all duration-200 hover:scale-105"
          >
            Discover Movies
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {watchlist.map(movie => (
            <MovieCard key={movie.id} movie={movie} onDetails={onDetails} />
          ))}
        </div>
      )}
    </div>
  );
}
