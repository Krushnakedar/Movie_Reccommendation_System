import { useState } from 'react';
import { Film } from 'lucide-react';

/**
 * <img> with a built-in, offline fallback (no external placeholder service).
 * Shown when TMDB has no image for the title or when the image fails to load.
 */
export default function PosterImage({ src, alt, title, className = '', showTitle = true }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const failed = !src || failedSrc === src;

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-cinema-card to-cinema-dark p-3 text-center text-cinema-muted ${className}`}
      >
        <Film size={28} className="opacity-60" aria-hidden="true" />
        {showTitle && <span className="line-clamp-3 text-xs">{title || alt}</span>}
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailedSrc(src)} />;
}
