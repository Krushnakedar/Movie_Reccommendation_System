import { LANGUAGE_COVERAGE_NOTE } from './catalog.js';
import {
  parseDiscoverQuery,
  parseMovieId,
  parsePage,
  parseSearchQuery,
  parseTimeWindow,
  parseYear,
} from './validators.js';

const MINUTES = 60;
const HOURS = 60 * MINUTES;

/**
 * Declarative route table. Each handler receives `{ query, params }`, validates its own input,
 * and returns plain JSON. `maxAge` is the browser Cache-Control max-age in seconds.
 *
 * Kept free of Express so every endpoint can be unit-tested directly.
 *
 * @param {ReturnType<import('./catalog.js').createCatalog>} catalog
 */
export function buildRoutes(catalog) {
  return [
    {
      path: '/health',
      maxAge: 0,
      handler: async ({ query }) => {
        const body = { status: 'ok', service: 'cinematch-api', time: new Date().toISOString() };
        if (query.deep === 'true') {
          // Verifies the TMDB token end-to-end. Errors surface through the normal error handler.
          const genres = await catalog.genres();
          return { ...body, tmdb: 'ok', genreCount: genres.length };
        }
        return body;
      },
    },
    {
      path: '/genres',
      maxAge: 1 * HOURS,
      handler: async () => {
        const genres = await catalog.genres();
        return { genres, count: genres.length, source: 'TMDB' };
      },
    },
    {
      path: '/languages',
      maxAge: 1 * HOURS,
      handler: async () => {
        const languages = await catalog.languages();
        return { languages, count: languages.length, source: 'TMDB', note: LANGUAGE_COVERAGE_NOTE };
      },
    },
    {
      path: '/config/images',
      maxAge: 1 * HOURS,
      handler: () => catalog.imageConfig(),
    },
    {
      path: '/movies/popular',
      maxAge: 1 * MINUTES,
      handler: ({ query }) => catalog.list('popular', { page: parsePage(query.page) }),
    },
    {
      path: '/movies/top-rated',
      maxAge: 1 * MINUTES,
      handler: ({ query }) => catalog.list('top-rated', { page: parsePage(query.page) }),
    },
    {
      path: '/movies/upcoming',
      maxAge: 1 * MINUTES,
      handler: ({ query }) => catalog.list('upcoming', { page: parsePage(query.page) }),
    },
    {
      path: '/movies/trending',
      maxAge: 1 * MINUTES,
      handler: ({ query }) =>
        catalog.trending({ window: parseTimeWindow(query.window), page: parsePage(query.page) }),
    },
    {
      path: '/movies/search',
      maxAge: 1 * MINUTES,
      handler: ({ query }) =>
        catalog.search({
          query: parseSearchQuery(query.query),
          page: parsePage(query.page),
          year: parseYear('year', query.year),
        }),
    },
    {
      path: '/movies/discover',
      maxAge: 1 * MINUTES,
      handler: ({ query }) => catalog.discover(parseDiscoverQuery(query)),
    },
    // Must stay last: ":id" would otherwise swallow the named routes above.
    {
      path: '/movies/:id',
      maxAge: 5 * MINUTES,
      handler: ({ params }) => catalog.details(parseMovieId(params.id)),
    },
  ];
}
