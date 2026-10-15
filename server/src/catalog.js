import { cacheKey } from './cache.js';
import { DEFAULT_IMAGE_CONFIG, normalizeDetails, normalizePage, parseImageConfig } from './normalize.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** How long each kind of TMDB response is cached on the server. */
export const TTL = Object.freeze({
  meta: 24 * HOUR, // genres, languages, image configuration (change very rarely)
  list: 10 * MINUTE, // popular / trending / top rated / upcoming
  discover: 10 * MINUTE,
  search: 5 * MINUTE,
  details: HOUR,
});

export const LANGUAGE_COVERAGE_NOTE =
  "Languages come straight from TMDB's list of supported languages. Whether a language has movies " +
  "depends on what TMDB's community has added, so catalogue size and the completeness of titles, " +
  'descriptions and posters vary from language to language.';

const LIST_PATHS = Object.freeze({
  popular: '/movie/popular',
  'top-rated': '/movie/top_rated',
  upcoming: '/movie/upcoming',
});

/**
 * @param {object} deps
 * @param {{get: (path: string, params?: object) => Promise<any>}} deps.tmdb
 * @param {ReturnType<import('./cache.js').createCache>} deps.cache
 * @param {{defaultLanguage: string}} deps.config
 */
export function createCatalog({ tmdb, cache, config, logger = console, today = () => new Date().toISOString().slice(0, 10) }) {
  const uiLanguage = config.defaultLanguage;

  const cached = (path, params, ttl) => cache.remember(cacheKey(path, params), ttl, () => tmdb.get(path, params));

  async function getGenres() {
    const raw = await cached('/genre/movie/list', { language: uiLanguage }, TTL.meta);
    return (Array.isArray(raw?.genres) ? raw.genres : [])
      .filter((g) => g && Number.isInteger(g.id) && g.name)
      .map(({ id, name }) => ({ id, name }));
  }

  /** Every language TMDB returns, sorted by English name. Nothing is filtered out. */
  async function getLanguages() {
    const raw = await cached('/configuration/languages', {}, TTL.meta);
    return (Array.isArray(raw) ? raw : [])
      .filter((l) => l && typeof l.iso_639_1 === 'string' && l.iso_639_1)
      .map((l) => {
        const english = (l.english_name || '').trim();
        const native = (l.name || '').trim();
        const name = english || native || l.iso_639_1;
        return { code: l.iso_639_1, name, nativeName: native && native !== name ? native : null };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }

  async function getImageConfig() {
    try {
      return parseImageConfig(await cached('/configuration', {}, TTL.meta));
    } catch (err) {
      logger.warn(`[catalog] could not load TMDB image configuration (${err.code || err.message}); using documented defaults`);
      return DEFAULT_IMAGE_CONFIG;
    }
  }

  /** Lookup tables the normalizer needs. Genre/language failures degrade gracefully. */
  async function getContext() {
    const [genres, languages, images] = await Promise.all([
      getGenres().catch((err) => {
        logger.warn(`[catalog] genre list unavailable (${err.code || err.message})`);
        return [];
      }),
      getLanguages().catch((err) => {
        logger.warn(`[catalog] language list unavailable (${err.code || err.message})`);
        return [];
      }),
      getImageConfig(),
    ]);
    return {
      genreMap: new Map(genres.map((g) => [g.id, g.name])),
      languageMap: new Map(languages.map((l) => [l.code, l.name])),
      images,
    };
  }

  async function getPage(path, params, ttl) {
    const [raw, ctx] = await Promise.all([cached(path, params, ttl), getContext()]);
    return normalizePage(raw, ctx);
  }

  /** @param {'popular'|'top-rated'|'upcoming'} kind */
  function list(kind, { page }) {
    const path = LIST_PATHS[kind];
    return getPage(path, { language: uiLanguage, page }, TTL.list);
  }

  function trending({ window, page }) {
    return getPage(`/trending/movie/${window}`, { language: uiLanguage, page }, TTL.list);
  }

  function search({ query, page, year }) {
    return getPage(
      '/search/movie',
      { query, include_adult: false, language: uiLanguage, page, primary_release_year: year },
      TTL.search
    );
  }

  /** Builds TMDB /discover/movie parameters from validated options. */
  function discoverParams(o) {
    const params = {
      include_adult: false,
      include_video: false,
      language: uiLanguage,
      page: o.page,
      sort_by: o.sortBy,
    };
    // TMDB: comma = AND, pipe = OR
    if (o.genres.length) params.with_genres = o.genres.join(o.genreMode === 'and' ? ',' : '|');
    if (o.language) params.with_original_language = o.language;
    if (o.minRating > 0) params['vote_average.gte'] = o.minRating;
    if (o.maxRating !== undefined) params['vote_average.lte'] = o.maxRating;

    // A "10/10" from two votes is noise. When ranking by rating (or filtering on it) require a
    // minimum number of votes. The threshold is lower for a specific language because films in
    // smaller languages usually have far fewer TMDB votes.
    const ranksByRating = o.sortBy.startsWith('vote_average');
    const defaultVotes = o.minRating > 0 || ranksByRating ? (o.language ? 10 : 50) : 0;
    const minVotes = o.minVotes ?? defaultVotes;
    if (minVotes > 0) params['vote_count.gte'] = minVotes;

    if (o.yearFrom) params['primary_release_date.gte'] = `${o.yearFrom}-01-01`;
    if (o.yearTo) params['primary_release_date.lte'] = `${o.yearTo}-12-31`;
    else if (o.sortBy === 'primary_release_date.desc') params['primary_release_date.lte'] = today(); // "Newest" = already released
    return params;
  }

  function discover(options) {
    return getPage('/discover/movie', discoverParams(options), TTL.discover);
  }

  async function details(id) {
    const params = {
      language: uiLanguage,
      append_to_response: 'credits,videos',
      include_video_language: 'en,null',
    };
    const [raw, ctx] = await Promise.all([cached(`/movie/${id}`, params, TTL.details), getContext()]);
    return normalizeDetails(raw, ctx);
  }

  /** Pre-load rarely-changing data so the first page view is fast and credentials are checked early. */
  function warmUp() {
    return Promise.allSettled([getGenres(), getLanguages(), cached('/configuration', {}, TTL.meta)]);
  }

  return { list, trending, search, discover, details, genres: getGenres, languages: getLanguages, imageConfig: getImageConfig, warmUp };
}
