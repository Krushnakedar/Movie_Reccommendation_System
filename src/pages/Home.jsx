import MovieGrid from '../components/MovieGrid';
import SectionHeader from '../components/SectionHeader';
import { useApi } from '../hooks/useApi';
import { HOME_ROW_SIZE } from '../lib/constants';
import { getPopular, getTopRated, getTrending, getUpcoming } from '../services/api';

function Row({ type, title, subtitle, category, fetcher, onDetails, onNavigate }) {
  const { data, loading, error, retry } = useApi(fetcher, []);
  const movies = data ? data.results.slice(0, HOME_ROW_SIZE) : [];

  return (
    <div>
      <SectionHeader type={type} title={title} subtitle={subtitle} onViewAll={() => onNavigate('discover', category)} />
      <MovieGrid
        compact
        movies={movies}
        loading={loading}
        error={error}
        onRetry={retry}
        onDetails={onDetails}
        skeletonCount={6}
        emptyMessage="TMDB returned no movies for this section right now."
      />
    </div>
  );
}

export default function Home({ onDetails, onNavigate }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16 py-8">
      <Row
        type="trending"
        title="Trending Now"
        subtitle="What everyone's watching this week"
        category="trending"
        fetcher={(signal) => getTrending({ window: 'week' }, signal)}
        onDetails={onDetails}
        onNavigate={onNavigate}
      />
      <Row
        type="popular"
        title="Popular Movies"
        subtitle="Fan favourites across all genres"
        category="popular"
        fetcher={(signal) => getPopular({}, signal)}
        onDetails={onDetails}
        onNavigate={onNavigate}
      />
      <Row
        type="rated"
        title="Top Rated"
        subtitle="The highest-rated films on TMDB"
        category="top-rated"
        fetcher={(signal) => getTopRated({}, signal)}
        onDetails={onDetails}
        onNavigate={onNavigate}
      />
      <Row
        type="upcoming"
        title="Upcoming Movies"
        subtitle="Coming soon to cinemas"
        category="upcoming"
        fetcher={(signal) => getUpcoming({}, signal)}
        onDetails={onDetails}
        onNavigate={onNavigate}
      />
    </div>
  );
}
