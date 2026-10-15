import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCache } from '../src/cache.js';
import { HttpError } from '../src/errors.js';
import {
  buildImageUrl,
  DEFAULT_IMAGE_CONFIG,
  normalizeMovie,
  normalizePage,
  parseImageConfig,
  pickSize,
} from '../src/normalize.js';

const ctx = {
  genreMap: new Map([[28, 'Action'], [12, 'Adventure']]),
  languageMap: new Map([['en', 'English'], ['mr', 'Marathi']]),
  images: DEFAULT_IMAGE_CONFIG,
};

test('buildImageUrl follows base_url + size + file_path and handles missing paths', () => {
  assert.equal(
    buildImageUrl(DEFAULT_IMAGE_CONFIG, 'poster', '/1E5baAaEse26fej7uHcjOgEE2t2.jpg'),
    'https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg'
  );
  assert.equal(buildImageUrl(DEFAULT_IMAGE_CONFIG, 'backdrop', '/b.jpg'), 'https://image.tmdb.org/t/p/w1280/b.jpg');
  for (const missing of [null, undefined, '', 'no-leading-slash', 42]) {
    assert.equal(buildImageUrl(DEFAULT_IMAGE_CONFIG, 'poster', missing), null);
  }
});

test('pickSize falls back to the closest offered width', () => {
  assert.equal(pickSize(['w185', 'w342', 'w780', 'original'], 'w500'), 'w342');
  assert.equal(pickSize(['original'], 'w500'), 'original');
});

test('parseImageConfig reads TMDB /configuration and falls back to defaults when malformed', () => {
  const parsed = parseImageConfig({
    images: { secure_base_url: 'https://img.example/t/p', poster_sizes: ['w200', 'original'] },
  });
  assert.equal(parsed.secureBaseUrl, 'https://img.example/t/p/');
  assert.deepEqual(parsed.posterSizes, ['w200', 'original']);
  assert.deepEqual(parsed.backdropSizes, DEFAULT_IMAGE_CONFIG.backdropSizes);
  assert.equal(parseImageConfig(null), DEFAULT_IMAGE_CONFIG);
  assert.equal(parseImageConfig({ images: { secure_base_url: 'http://insecure/' } }), DEFAULT_IMAGE_CONFIG);
});

test('normalizeMovie maps a complete TMDB movie', () => {
  const m = normalizeMovie(
    {
      id: 1, title: 'T', original_title: 'T0', overview: ' Hi ', poster_path: '/p.jpg', backdrop_path: '/b.jpg',
      release_date: '2023-07-21', vote_average: 8.26, vote_count: 10, popularity: 5, genre_ids: [28, 12, 999], original_language: 'en',
    },
    ctx
  );
  assert.equal(m.year, 2023);
  assert.equal(m.rating, 8.3);
  assert.equal(m.ratingSource, 'TMDB');
  assert.deepEqual(m.genre, ['Action', 'Adventure']); // unknown id 999 is skipped, not shown as "undefined"
  assert.equal(m.description, 'Hi');
  assert.equal(m.languageName, 'English');
  assert.ok(m.poster.endsWith('/w500/p.jpg'));
});

test('normalizeMovie survives missing poster, overview, date, and ratings', () => {
  const m = normalizeMovie({ id: 2, title: '', original_title: 'Orig', vote_average: 0, vote_count: 0, original_language: 'mr' }, ctx);
  assert.equal(m.title, 'Orig');
  assert.equal(m.poster, null);
  assert.equal(m.backdrop, null);
  assert.equal(m.description, '');
  assert.equal(m.year, null);
  assert.equal(m.releaseDate, null);
  assert.equal(m.rating, null, 'unrated titles must not show a misleading 0.0');
  assert.deepEqual(m.genre, []);
  assert.equal(m.languageName, 'Marathi');
});

test('normalizePage caps totalPages at 500 and drops malformed rows', () => {
  const page = normalizePage({ page: 3, total_pages: 99999, total_results: 5, results: [{ id: 1, title: 'a' }, null, { title: 'no id' }] }, ctx);
  assert.equal(page.page, 3);
  assert.equal(page.totalPages, 500);
  assert.equal(page.results.length, 1);
  assert.equal(normalizePage(undefined, ctx).results.length, 0);
});

test('cache: serves hits, de-duplicates concurrent loads, and falls back to stale data on transient errors', async () => {
  let time = 1000;
  const cache = createCache({ now: () => time });
  let loads = 0;
  const loader = async () => {
    loads += 1;
    await new Promise((r) => setTimeout(r, 10));
    return { n: loads };
  };

  const [a, b] = await Promise.all([cache.remember('k', 100, loader), cache.remember('k', 100, loader)]);
  assert.equal(loads, 1, 'concurrent callers share one load');
  assert.equal(a, b);
  await cache.remember('k', 100, loader);
  assert.equal(loads, 1, 'fresh entry is served from cache');

  time += 500; // expired
  const refreshed = await cache.remember('k', 100, loader);
  assert.equal(loads, 2);
  assert.equal(refreshed.n, 2);

  time += 500; // expired again, and TMDB is rate limiting us
  const stale = await cache.remember('k', 100, async () => {
    throw new HttpError(429, 'rate limited');
  });
  assert.equal(stale.n, 2, 'stale copy is served on a transient error');

  await assert.rejects(
    cache.remember('k', 100, async () => {
      throw new HttpError(404, 'gone'); // not transient: must not be masked
    }),
    (err) => err.status === 404
  );
});

test('cache: evicts oldest entries beyond maxEntries', async () => {
  const cache = createCache({ maxEntries: 2 });
  await cache.remember('a', 1000, async () => 1);
  await cache.remember('b', 1000, async () => 2);
  await cache.remember('c', 1000, async () => 3);
  assert.equal(cache.size, 2);
});
