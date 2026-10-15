import { useState, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import MovieModal from './components/MovieModal';
import SearchResults from './components/SearchResults';
import TmdbAttribution from './components/TmdbAttribution';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import Home from './pages/Home';
import Discover from './pages/Discover';
import Recommendations from './pages/Recommendations';
import Watchlist from './pages/Watchlist';

function AppContent() {
  const { searchQuery, setSearchQuery } = useApp();
  const [section, setSection] = useState('home');
  const [discoverCategory, setDiscoverCategory] = useState('popular');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showHero, setShowHero] = useState(true);

  // Search results replace the current page while the search box has text in it.
  const typedQuery = searchQuery.trim();
  const debouncedQuery = useDebouncedValue(typedQuery, 400);
  const searching = typedQuery.length > 0;

  // `category` is only used for Discover, so "View All" on a Home row opens that same category.
  const navigate = useCallback(
    (to, category) => {
      if (to === 'discover') setDiscoverCategory(category || 'popular');
      setSearchQuery('');
      setSection(to);
      setShowHero(to === 'home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setSearchQuery]
  );

  const handleDetails = useCallback((movie) => {
    setSelectedMovie(movie);
  }, []);

  const closeModal = useCallback(() => setSelectedMovie(null), []);

  const heroVisible = section === 'home' && showHero && !searching;

  return (
    <div className="min-h-screen bg-cinema-black">
      <Navbar onNavigate={navigate} currentSection={section} />

      <main>
        {heroVisible && <Hero onDiscover={(to) => navigate(to)} />}

        <div className={heroVisible ? '' : 'pt-20'}>
          {searching ? (
            <SearchResults
              query={debouncedQuery}
              pending={typedQuery !== debouncedQuery}
              onDetails={handleDetails}
              onClear={() => setSearchQuery('')}
            />
          ) : (
            <>
              {section === 'home' && <Home onDetails={handleDetails} onNavigate={navigate} />}
              {section === 'discover' && <Discover onDetails={handleDetails} initialCategory={discoverCategory} />}
              {section === 'recommendations' && <Recommendations onDetails={handleDetails} />}
              {section === 'watchlist' && <Watchlist onDetails={handleDetails} onNavigate={navigate} />}
            </>
          )}
        </div>
      </main>

      <MovieModal movie={selectedMovie} onClose={closeModal} />

      <footer className="mt-20 border-t border-cinema-border py-10 text-center text-cinema-muted text-sm">
        <p className="mb-3">
          🎬 <strong className="text-white">CineMatch</strong> — Movie recommendations ranked by TMDB ratings
        </p>
        <TmdbAttribution className="mx-auto max-w-2xl px-4" />
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
