/**
 * Turns raw TMDB payloads into the shape the React UI consumes.
 * Image URLs are built the way TMDB documents it:
 *   secure_base_url (from GET /configuration) + size + file_path
 * https://developer.themoviedb.org/docs/image-basics
 */

export const MAX_TMDB_PAGES = 500; // TMDB does not serve pages beyond 500

export const DEFAULT_IMAGE_CONFIG = Object.freeze({
  secureBaseUrl: 'https://image.tmdb.org/t/p/',
  posterSizes: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
  backdropSizes: ['w300', 'w780', 'w1280', 'original'],
  profileSizes: ['w45', 'w185', 'h632', 'original'],
});

const asStringArray = (v, fallback) =>
  Array.isArray(v) && v.length && v.every((s) => typeof s === 'string') ? v : fallback;

/** Parse the response of GET /configuration. Falls back to documented defaults. */
export function parseImageConfig(raw) {
  const images = raw?.images;
  const base = images?.secure_base_url;
  if (typeof base !== 'string' || !base.startsWith('https://')) return DEFAULT_IMAGE_CONFIG;
  return Object.freeze({
    secureBaseUrl: base.endsWith('/') ? base : `${base}/`,
    posterSizes: asStringArray(images.poster_sizes, DEFAULT_IMAGE_CONFIG.posterSizes),
    backdropSizes: asStringArray(images.backdrop_sizes, DEFAULT_IMAGE_CONFIG.backdropSizes),
    profileSizes: asStringArray(images.profile_sizes, DEFAULT_IMAGE_CONFIG.profileSizes),
  });
}

/** Pick the preferred size if TMDB offers it, otherwise the closest width. */
export function pickSize(sizes, preferred) {
  if (sizes.includes(preferred)) return preferred;
  const target = Number(String(preferred).replace(/\D/g, '')) || 500;
  let best = null;
  for (const size of sizes) {
    const n = /^w(\d+)$/.exec(size);
    if (!n) continue;
    const diff = Math.abs(Number(n[1]) - target);
    if (!best || diff < best.diff) best = { size, diff };
  }
  return best ? best.size : sizes.includes('original') ? 'original' : sizes[sizes.length - 1];
}

/**
 * @param {typeof DEFAULT_IMAGE_CONFIG} images
 * @param {'poster'|'backdrop'|'profile'} kind
 * @param {string | null | undefined} filePath  e.g. "/abc123.jpg"
 * @returns {string | null} null when TMDB has no image for this item
 */
export function buildImageUrl(images, kind, filePath, preferredSize) {
  if (typeof filePath !== 'string' || !filePath.startsWith('/')) return null;
  const sizes = images[`${kind}Sizes`];
  const preferred = preferredSize || { poster: 'w500', backdrop: 'w1280', profile: 'w185' }[kind];
  return `${images.secureBaseUrl}${pickSize(sizes, preferred)}${filePath}`;
}

/**
 * @typedef {object} NormalizeContext
 * @property {Map<number, string>} genreMap
 * @property {Map<string, string>} languageMap  ISO code -> English name
 * @property {typeof DEFAULT_IMAGE_CONFIG} images
 */

/** @param {any} raw @param {NormalizeContext} ctx */
export function normalizeMovie(raw, ctx) {
  const releaseDate = typeof raw.release_date === 'string' && raw.release_date ? raw.release_date : null;
  const year = releaseDate && /^\d{4}/.test(releaseDate) ? Number(releaseDate.slice(0, 4)) : null;
  const voteCount = Number.isFinite(raw.vote_count) ? raw.vote_count : 0;
  // TMDB reports vote_average 0 for titles nobody has rated; show that as "no rating".
  const rating =
    voteCount > 0 && Number.isFinite(raw.vote_average) ? Math.round(raw.vote_average * 10) / 10 : null;

  const genreIds = Array.isArray(raw.genres)
    ? raw.genres.map((g) => g.id)
    : Array.isArray(raw.genre_ids)
      ? raw.genre_ids
      : [];
  const genre = Array.isArray(raw.genres)
    ? raw.genres.map((g) => g.name).filter(Boolean)
    : genreIds.map((id) => ctx.genreMap.get(id)).filter(Boolean);

  const language = typeof raw.original_language === 'string' && raw.original_language ? raw.original_language : null;

  return {
    id: raw.id,
    title: raw.title || raw.original_title || 'Untitled',
    originalTitle: raw.original_title || null,
    year,
    releaseDate,
    rating,
    voteCount,
    ratingSource: 'TMDB',
    popularity: Number.isFinite(raw.popularity) ? raw.popularity : null,
    genre,
    genreIds,
    poster: buildImageUrl(ctx.images, 'poster', raw.poster_path),
    backdrop: buildImageUrl(ctx.images, 'backdrop', raw.backdrop_path),
    description: typeof raw.overview === 'string' ? raw.overview.trim() : '',
    language,
    languageName: language ? ctx.languageMap.get(language) || null : null,
  };
}

/** @param {any} raw @param {NormalizeContext} ctx */
export function normalizePage(raw, ctx) {
  const results = Array.isArray(raw?.results)
    ? raw.results.filter((m) => m && Number.isInteger(m.id)).map((m) => normalizeMovie(m, ctx))
    : [];
  return {
    page: Number(raw?.page) || 1,
    totalPages: Math.min(Number(raw?.total_pages) || 0, MAX_TMDB_PAGES),
    totalResults: Number(raw?.total_results) || 0,
    results,
  };
}

const YOUTUBE_KEY = /^[\w-]{6,20}$/;

function pickTrailer(videos) {
  const candidates = (Array.isArray(videos) ? videos : []).filter(
    (v) => v && v.site === 'YouTube' && typeof v.key === 'string' && YOUTUBE_KEY.test(v.key)
  );
  const rank = (v) => (v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 1 : 2) * 2 + (v.official ? 0 : 1);
  candidates.sort((a, b) => rank(a) - rank(b));
  const best = candidates.find((v) => v.type === 'Trailer' || v.type === 'Teaser');
  return best
    ? { name: best.name || 'Trailer', key: best.key, url: `https://www.youtube.com/watch?v=${best.key}` }
    : null;
}

/** Movie details response (with credits + videos appended). */
export function normalizeDetails(raw, ctx) {
  const base = normalizeMovie(raw, ctx);
  const crew = Array.isArray(raw.credits?.crew) ? raw.credits.crew : [];
  const cast = Array.isArray(raw.credits?.cast) ? raw.credits.cast : [];

  const directors = [...new Set(crew.filter((c) => c.job === 'Director' && c.name).map((c) => c.name))];
  const castNames = [...new Set(cast.filter((c) => c.name).map((c) => c.name))].slice(0, 10);

  return {
    ...base,
    tagline: typeof raw.tagline === 'string' && raw.tagline.trim() ? raw.tagline.trim() : null,
    status: raw.status || null,
    duration: Number.isFinite(raw.runtime) && raw.runtime > 0 ? raw.runtime : null,
    director: directors.length ? directors.join(', ') : null,
    cast: castNames,
    trailer: pickTrailer(raw.videos?.results),
    homepage: typeof raw.homepage === 'string' && /^https?:\/\//.test(raw.homepage) ? raw.homepage : null,
  };
}
