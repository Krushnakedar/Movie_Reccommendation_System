/**
 * Browser-side API client for the CineMatch Express backend.
 *
 * - Only talks to the backend (`/api/...`). It never contacts TMDB directly and never sees the token.
 * - In development Vite proxies `/api` to the backend (see vite.config.js).
 * - For a separately hosted frontend, set VITE_API_BASE_URL (e.g. https://api.example.com/api).
 */
const BASE = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', retryAfter } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function buildUrl(path, params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  }
  const query = qs.toString();
  return `${BASE}${path}${query ? `?${query}` : ''}`;
}

async function request(path, params, { signal } = {}) {
  let res;
  try {
    res = await fetch(buildUrl(path, params), { headers: { Accept: 'application/json' }, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(
      "Can't reach the CineMatch server. Make sure the backend is running (npm run dev:server) and try again.",
      { code: 'NETWORK' }
    );
  }

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const apiError = body?.error;
    if (apiError?.message) {
      throw new ApiError(apiError.message, {
        status: res.status,
        code: apiError.code,
        retryAfter: apiError.retryAfter,
      });
    }
    // No JSON body: typically the dev proxy reporting that the backend is down.
    if (res.status >= 500) {
      throw new ApiError(
        "The CineMatch server isn't responding. Make sure the backend is running (npm run dev:server) and try again.",
        { status: res.status, code: 'SERVER_DOWN' }
      );
    }
    throw new ApiError(`The request failed (HTTP ${res.status}).`, { status: res.status });
  }

  if (body === null) {
    throw new ApiError('The server sent a response that could not be read.', { status: res.status, code: 'BAD_RESPONSE' });
  }
  return body;
}

// ---- Catalogue sections --------------------------------------------------------------------

export const getTrending = ({ window = 'week', page = 1 } = {}, signal) =>
  request('/movies/trending', { window, page }, { signal });

export const getPopular = ({ page = 1 } = {}, signal) => request('/movies/popular', { page }, { signal });

export const getTopRated = ({ page = 1 } = {}, signal) => request('/movies/top-rated', { page }, { signal });

export const getUpcoming = ({ page = 1 } = {}, signal) => request('/movies/upcoming', { page }, { signal });

// ---- Search, discovery, details --------------------------------------------------------------

export const searchMovies = ({ query, page = 1, year } = {}, signal) =>
  request('/movies/search', { query, page, year }, { signal });

/**
 * @param {{genres?: number|string|Array<number|string>, genreMode?: 'or'|'and', language?: string,
 *          minRating?: number, maxRating?: number, minVotes?: number, yearFrom?: number, yearTo?: number,
 *          sortBy?: string, page?: number}} [opts]
 */
export const discoverMovies = (opts = {}, signal) =>
  request(
    '/movies/discover',
    {
      genres: Array.isArray(opts.genres) ? opts.genres.join(',') : opts.genres,
      genreMode: opts.genreMode,
      language: opts.language,
      minRating: opts.minRating > 0 ? opts.minRating : undefined,
      maxRating: opts.maxRating,
      minVotes: opts.minVotes,
      yearFrom: opts.yearFrom,
      yearTo: opts.yearTo,
      sortBy: opts.sortBy,
      page: opts.page || 1,
    },
    { signal }
  );

export const getMovieDetails = (id, signal) => request(`/movies/${encodeURIComponent(id)}`, {}, { signal });

// ---- Reference data (genres / languages): fetched once per page load ------------------------

const metaCache = new Map();

function cachedMeta(key, loader) {
  if (!metaCache.has(key)) {
    const promise = loader().catch((err) => {
      metaCache.delete(key); // allow a retry after a failure
      throw err;
    });
    metaCache.set(key, promise);
  }
  return metaCache.get(key);
}

/** @returns {Promise<Array<{id: number, name: string}>>} */
export const getGenres = () => cachedMeta('genres', () => request('/genres').then((r) => r.genres));

/** @returns {Promise<Array<{code: string, name: string, nativeName: string|null}>>} */
export const getLanguages = () => cachedMeta('languages', () => request('/languages').then((r) => r.languages));
