import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createCache } from '../src/cache.js';
import { createCatalog } from '../src/catalog.js';
import { HttpError } from '../src/errors.js';
import { buildRoutes } from '../src/routes.js';
import { createTmdbClient } from '../src/tmdbClient.js';
import { silentLogger, startFakeTmdb, TEST_TOKEN } from './helpers/fakeTmdb.js';

let fake;
let routes;
const config = { defaultLanguage: 'en-US' };

before(async () => {
  fake = await startFakeTmdb();
});
after(async () => {
  await fake.close();
});

beforeEach(() => {
  fake.hits.length = 0;
  fake.setHook(null);
  const tmdb = createTmdbClient({ baseUrl: fake.baseUrl, token: TEST_TOKEN, sleep: async () => {}, logger: silentLogger });
  const catalog = createCatalog({ tmdb, cache: createCache(), config, logger: silentLogger, today: () => '2026-10-15' });
  routes = Object.fromEntries(buildRoutes(catalog).map((r) => [r.path, r.handler]));
});

// async so that a synchronous validation error thrown by a handler surfaces as a rejected promise,
// exactly like it does in app.js (which awaits the handler inside try/catch).
const call = async (path, { query = {}, params = {} } = {}) => routes[path]({ query, params });
const tmdbHits = (path) => fake.hits.filter((h) => h.path === path);

test('GET /genres returns the TMDB genre list', async () => {
  const body = await call('/genres');
  assert.equal(body.source, 'TMDB');
  assert.deepEqual(body.genres[0], { id: 28, name: 'Action' });
  assert.equal(body.count, 4);
});

test('GET /languages returns every language TMDB returns (nothing filtered, nothing hardcoded)', async () => {
  const body = await call('/languages');
  assert.equal(body.count, 7);
  const codes = body.languages.map((l) => l.code).sort();
  assert.deepEqual(codes, ['ab', 'cn', 'en', 'hi', 'mr', 'te', 'xx']);
  // Sorted by English name; entries with a blank english_name fall back to the native name.
  const names = body.languages.map((l) => l.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')));
  assert.equal(body.languages.find((l) => l.code === 'ab').name, 'Аҧсуа');
  assert.equal(body.languages.find((l) => l.code === 'hi').nativeName, 'हिन्दी');
  assert.equal(body.languages.find((l) => l.code === 'en').nativeName, null);
  assert.match(body.note, /TMDB/);
});

test('list endpoints return normalized movies with real image URLs and graceful gaps', async () => {
  for (const path of ['/movies/popular', '/movies/top-rated', '/movies/upcoming', '/movies/trending']) {
    const body = await call(path, { query: { page: '2' } });
    assert.equal(body.page, 2);
    assert.equal(body.totalPages, 500, `${path}: capped at TMDB's 500 page limit`);
    assert.equal(body.results.length, 2);
    const [full, sparse] = body.results;
    assert.equal(full.title, 'Fixture Movie One');
    assert.equal(full.poster, 'https://image.tmdb.org/t/p/w500/poster101.jpg');
    assert.equal(full.backdrop, 'https://image.tmdb.org/t/p/w1280/backdrop101.jpg');
    assert.deepEqual(full.genre, ['Action', 'Adventure']);
    assert.equal(full.languageName, 'English');
    assert.equal(full.rating, 8.3);
    assert.equal(full.voteCount, 1234);
    assert.equal(full.ratingSource, 'TMDB');
    assert.equal(sparse.title, 'Sparse Original Title');
    assert.equal(sparse.poster, null);
    assert.equal(sparse.rating, null);
    assert.equal(sparse.description, '');
  }
  assert.equal(tmdbHits('/movie/popular')[0].params.page, '2');
  assert.equal(tmdbHits('/movie/top_rated').length, 1);
  assert.equal(tmdbHits('/trending/movie/week').length, 1);
});

test('trending honours the day/week window', async () => {
  await call('/movies/trending', { query: { window: 'day' } });
  assert.equal(tmdbHits('/trending/movie/day').length, 1);
});

test('search forwards the query, forces include_adult=false, and rejects empty queries', async () => {
  const body = await call('/movies/search', { query: { query: '  fixture   movie ', page: '1', year: '2024' } });
  assert.equal(body.results.length, 2);
  const hit = tmdbHits('/search/movie')[0];
  assert.equal(hit.params.query, 'fixture movie');
  assert.equal(hit.params.include_adult, 'false');
  assert.equal(hit.params.primary_release_year, '2024');
  await assert.rejects(call('/movies/search', { query: { query: '   ' } }), (e) => e instanceof HttpError && e.status === 400);
  await assert.rejects(call('/movies/search', { query: {} }), (e) => e.status === 400);
});

test('discover builds TMDB filters: OR genres, original language, rating, years, vote floor', async () => {
  await call('/movies/discover', {
    query: { genres: '28,12', language: 'hi', minRating: '7', yearFrom: '2010', yearTo: '2019', sortBy: 'popularity.desc', page: '3' },
  });
  const p = tmdbHits('/discover/movie')[0].params;
  assert.equal(p.with_genres, '28|12'); // pipe = OR in TMDB
  assert.equal(p.with_original_language, 'hi');
  assert.equal(p['vote_average.gte'], '7');
  assert.equal(p['vote_count.gte'], '10', 'lower vote floor when a specific language is chosen');
  assert.equal(p['primary_release_date.gte'], '2010-01-01');
  assert.equal(p['primary_release_date.lte'], '2019-12-31');
  assert.equal(p.sort_by, 'popularity.desc');
  assert.equal(p.page, '3');
  assert.equal(p.include_adult, 'false');
});

test('discover: AND mode, default vote floors, and "Newest" excludes unreleased titles', async () => {
  await call('/movies/discover', { query: { genres: '28,12', genreMode: 'and', sortBy: 'vote_average.desc' } });
  let p = tmdbHits('/discover/movie')[0].params;
  assert.equal(p.with_genres, '28,12');
  assert.equal(p['vote_count.gte'], '50');
  assert.ok(!('with_original_language' in p));

  fake.hits.length = 0;
  await call('/movies/discover', { query: { sortBy: 'primary_release_date.desc' } });
  p = tmdbHits('/discover/movie')[0].params;
  assert.equal(p['primary_release_date.lte'], '2026-10-15');
  assert.ok(!('vote_count.gte' in p));
});

test('discover rejects invalid input before calling TMDB', async () => {
  for (const query of [{ page: '0' }, { page: '501' }, { genres: 'x' }, { language: '!!' }, { sortBy: 'nope' }, { minRating: '99' }]) {
    await assert.rejects(call('/movies/discover', { query }), (e) => e instanceof HttpError && e.status === 400);
  }
  assert.equal(tmdbHits('/discover/movie').length, 0);
});

test('movie details include runtime, director, cast, genres and a safe YouTube trailer', async () => {
  const d = await call('/movies/:id', { params: { id: '101' } });
  assert.equal(d.duration, 125);
  assert.equal(d.director, 'Director Person');
  assert.deepEqual(d.cast, ['Actor One', 'Actor Two']);
  assert.deepEqual(d.genre, ['Action', 'Adventure']);
  assert.equal(d.tagline, 'A fixture tagline');
  assert.deepEqual(d.trailer, { name: 'Official Trailer', key: 'trailerKey01', url: 'https://www.youtube.com/watch?v=trailerKey01' });
  const hit = tmdbHits('/movie/101')[0];
  assert.equal(hit.params.append_to_response, 'credits,videos');
});

test('movie details: unknown id -> 404, invalid id -> 400 without calling TMDB', async () => {
  await assert.rejects(call('/movies/:id', { params: { id: '999' } }), (e) => e.status === 404);
  fake.hits.length = 0;
  await assert.rejects(call('/movies/:id', { params: { id: 'abc' } }), (e) => e.status === 400);
  assert.equal(fake.hits.length, 0);
});

test('responses are cached: repeating a request does not hit TMDB again', async () => {
  await call('/movies/popular');
  const first = tmdbHits('/movie/popular').length;
  await call('/movies/popular');
  await call('/movies/popular');
  assert.equal(tmdbHits('/movie/popular').length, first);
  // genres / languages / image config are fetched once and reused across endpoints
  await call('/movies/top-rated');
  await call('/genres');
  assert.equal(tmdbHits('/genre/movie/list').length, 1);
  assert.equal(tmdbHits('/configuration/languages').length, 1);
  assert.equal(tmdbHits('/configuration').length, 1);
});

test('every TMDB request carried the Bearer token and never an api_key query param', async () => {
  await call('/movies/popular');
  await call('/movies/search', { query: { query: 'x' } });
  assert.ok(fake.hits.length > 0);
  for (const hit of fake.hits) {
    assert.equal(hit.auth, `Bearer ${TEST_TOKEN}`);
    assert.ok(!('api_key' in hit.params));
  }
});

test('when TMDB rate-limits us the error carries retryAfter for the client', async () => {
  fake.setHook(({ res }) => {
    res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '12' });
    res.end('{}');
    return true;
  });
  await assert.rejects(call('/movies/popular'), (e) => e.status === 429 && e.retryAfter === 12);
});

test('image configuration failure falls back to documented defaults instead of breaking lists', async () => {
  fake.setHook(({ path, res }) => {
    if (path !== '/configuration') return false;
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end('{}');
    return true;
  });
  const body = await call('/movies/popular');
  assert.equal(body.results[0].poster, 'https://image.tmdb.org/t/p/w500/poster101.jpg');
});

test('health: shallow check needs no TMDB call; deep check verifies the token', async () => {
  const shallow = await call('/health');
  assert.equal(shallow.status, 'ok');
  assert.equal(fake.hits.length, 0);
  const deep = await call('/health', { query: { deep: 'true' } });
  assert.equal(deep.tmdb, 'ok');
  assert.equal(deep.genreCount, 4);
});
