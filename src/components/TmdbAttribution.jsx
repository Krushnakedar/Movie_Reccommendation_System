/** Required TMDB credit. Add the official logo from https://www.themoviedb.org/about/logos-attribution if you publish the site. */
export default function TmdbAttribution({ className = '' }) {
  return (
    <p className={`text-xs text-cinema-muted ${className}`}>
      This product uses the{' '}
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-cinema-purple-light underline-offset-2 hover:underline"
      >
        TMDB
      </a>{' '}
      API but is not endorsed or certified by TMDB. Movie data, images and ratings are provided by TMDB.
    </p>
  );
}
