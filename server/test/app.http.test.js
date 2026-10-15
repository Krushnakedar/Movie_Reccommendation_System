import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createCache } from '../src/cache.js';
import { createCatalog } from '../src/catalog.js';
import { HttpError } from '../src/errors.js';
import { buildRoutes } from '../src/routes.js';
import { createTmdbClient } from '../src/tmdbClient.js';
import { silentLogger, startFakeTmdb, TEST_TOKEN } from './helpers/fakeTmdb.js';

/**
 * Full-stack tests: real Express app, real HTTP requests, real TmdbClient -- only TMDB itself is
 * replaced by the local fake. Covers wiring that the unit tests cannot: CORS, rate limiting,
 * Cache-Control headers, error JSON shape, and that secrets never reach a response.
 */

let fake;
before(async () => {
  fake = await startFakeTmdb();
});
after(async () => {
  await fake.close();
});

const CORS_ORIGIN = 'http://localhost:5173';

async function startApi({ token = TEST_TOKEN, baseUrl, rateLimitPerMinute = 1000, routes } = {}) {
  const config = { defaultLanguage: 'en-US', corsOrigins: [CORS_ORIGIN], rateLimitPerMinute };
  const tmdb = createTmdbClient({ baseUrl: baseUrl ?? fake.baseUrl, token, sleep: async () => {}, logger: silentLogger, maxRetries: 0 });
  const catalog = createCatalog({ tmdb, cache: createCache(), config, logger: silentLogger, today: () => '2026-10-15' });
  const app = createApp({ config, routes: routes ?? buildRoutes(catalog), logger: silentLogger });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  return { res, text, json: text ? JSON.parse(text) : null };
}

test('every endpoint answers 200 JSON over real HTTP, with sensible Cache-Control headers', async () => {
  const api = await startApi();
  try {
    const expectations = [
      ['/api/health', 'no-store'],
      ['/api/genres', 'public, max-age=3600'],
      ['/api/languages', 'public, max-age=3600'],
      ['/api/config/images', 'public, max-age=3600'],
      ['/api/movies/popular?page=2', 'public, max-age=60'],
      ['/api/movies/top-rated', 'public, max-age=60'],
      ['/api/movies/upcoming', 'public, max-age=60'],
      ['/api/movies/trending?window=day', 'public, max-age=60'],
      ['/api/movies/search?query=fixture', 'public, max-age=60'],
      ['/api/movies/discover?genres=28&language=en&minRating=7', 'public, max-age=60'],
      ['/api/movies/101', 'public, max-age=300'],
    ];
    for (const [path, cacheControl] of expectations) {
      const { res, json } = await getJson(api.url + path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get('content-type'), /application\/json/, path);
      assert.equal(res.headers.get('cache-control'), cacheControl, path);
      assert.ok(json && typeof json === 'object', path);
    }
    // contract spot-checks
    const pop = (await getJson(`${api.url}/api/movies/popular`)).json;
    assert.deepEqual(Object.keys(pop).sort(), ['page', 'results', 'totalPages', 'totalResults']);
    const langs = (await getJson(`${api.url}/api/languages`)).json;
    assert.equal(langs.count, langs.languages.length);
  } finally {
    await api.close();
  }
});

test('the X-Powered-By header is not sent', async () => {
  const api = await startApi();
  try {
    const { res } = await getJson(`${api.url}/api/health`);
    assert.equal(res.headers.get('x-powered-by'), null);
  } finally {
    await api.close();
  }
});

test('errors are JSON with { error: { status, code, message } }', async () => {
  const api = await startApi();
  try {
    const bad = await getJson(`${api.url}/api/movies/popular?page=0`);
    assert.equal(bad.res.status, 400);
    assert.equal(bad.json.error.status, 400);
    assert.equal(bad.json.error.code, 'INVALID_PARAMETER');
    assert.ok(bad.json.error.message.length > 0);

    const dup = await getJson(`${api.url}/api/movies/popular?page=1&page=2`);
    assert.equal(dup.res.status, 400, 'repeated query params are rejected, not coerced');

    const unknownRoute = await getJson(`${api.url}/api/nope`);
    assert.equal(unknownRoute.res.status, 404);
    assert.equal(unknownRoute.json.error.code, 'NOT_FOUND');

    const unknownMovie = await getJson(`${api.url}/api/movies/999`);
    assert.equal(unknownMovie.res.status, 404);

    const emptySearch = await getJson(`${api.url}/api/movies/search?query=`);
    assert.equal(emptySearch.res.status, 400);
  } finally {
    await api.close();
  }
});

test('CORS: the configured origin is allowed, other origins are not, preflight works', async () => {
  const api = await startApi();
  try {
    const allowed = await fetch(`${api.url}/api/genres`, { headers: { Origin: CORS_ORIGIN } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), CORS_ORIGIN);

    const evil = await fetch(`${api.url}/api/genres`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);

    const preflight = await fetch(`${api.url}/api/genres`, {
      method: 'OPTIONS',
      headers: { Origin: CORS_ORIGIN, 'Access-Control-Request-Method': 'GET' },
    });
    assert.ok(preflight.status === 204 || preflight.status === 200);
    assert.match(preflight.headers.get('access-control-allow-methods') || '', /GET/);
    assert.doesNotMatch(preflight.headers.get('access-control-allow-methods') || '', /POST|DELETE|PUT/);
  } finally {
    await api.close();
  }
});

test('rate limiting: over the limit -> 429 with Retry-After and a friendly message', async () => {
  const api = await startApi({ rateLimitPerMinute: 3 });
  try {
    for (let i = 0; i < 3; i += 1) {
      assert.equal((await getJson(`${api.url}/api/health`)).res.status, 200);
    }
    const limited = await getJson(`${api.url}/api/health`);
    assert.equal(limited.res.status, 429);
    assert.equal(limited.json.error.code, 'RATE_LIMITED');
    assert.ok(Number(limited.res.headers.get('retry-after')) >= 1);
    assert.ok(limited.json.error.retryAfter >= 1);
    assert.match(limited.json.error.message, /wait/i);
  } finally {
    await api.close();
  }
});

test('a wrong TMDB token yields a safe 502 and never leaks the token', async () => {
  const secret = 'super-secret-wrong-token-123';
  const api = await startApi({ token: secret });
  try {
    for (const path of ['/api/genres', '/api/movies/popular', '/api/health?deep=true']) {
      const { res, text, json } = await getJson(api.url + path);
      assert.equal(res.status, 502, path);
      assert.equal(json.error.code, 'TMDB_AUTH', path);
      assert.ok(!text.includes(secret), `${path} leaked the token`);
      assert.ok(!text.toLowerCase().includes('bearer'), `${path} leaked auth details`);
    }
  } finally {
    await api.close();
  }
});

test('TMDB unreachable -> 502 UPSTREAM_UNREACHABLE with a user-friendly message', async () => {
  const api = await startApi({ baseUrl: 'http://127.0.0.1:1/3' });
  try {
    const { res, json } = await getJson(`${api.url}/api/movies/popular`);
    assert.equal(res.status, 502);
    assert.equal(json.error.code, 'UPSTREAM_UNREACHABLE');
    assert.match(json.error.message, /internet connection/i);
  } finally {
    await api.close();
  }
});

test('TMDB timeout -> 504 UPSTREAM_TIMEOUT', async () => {
  const config = { defaultLanguage: 'en-US', corsOrigins: [CORS_ORIGIN], rateLimitPerMinute: 1000 };
  const tmdb = createTmdbClient({ baseUrl: fake.baseUrl, token: TEST_TOKEN, timeoutMs: 80, maxRetries: 0, sleep: async () => {}, logger: silentLogger });
  const catalog = createCatalog({ tmdb, cache: createCache(), config, logger: silentLogger });
  const app = createApp({ config, routes: buildRoutes(catalog), logger: silentLogger });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  fake.setHook(({ path }) => path === '/genre/movie/list'); // hang forever
  try {
    const { res, json } = await getJson(`http://127.0.0.1:${server.address().port}/api/genres`);
    assert.equal(res.status, 504);
    assert.equal(json.error.code, 'UPSTREAM_TIMEOUT');
  } finally {
    fake.setHook(null);
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('unexpected (non-HttpError) failures return a generic 500 and do not leak internals', async () => {
  const routes = [
    {
      path: '/boom',
      handler: () => {
        throw new Error('ECONNREFUSED postgres://admin:hunter2@10.0.0.5/db');
      },
    },
    {
      path: '/typed',
      handler: () => {
        throw new HttpError(503, 'Down for maintenance.', { code: 'UNAVAILABLE', retryAfter: 7 });
      },
    },
  ];
  const api = await startApi({ routes });
  try {
    const boom = await getJson(`${api.url}/api/boom`);
    assert.equal(boom.res.status, 500);
    assert.equal(boom.json.error.code, 'INTERNAL_ERROR');
    assert.ok(!boom.text.includes('hunter2') && !boom.text.includes('postgres'));

    const typed = await getJson(`${api.url}/api/typed`);
    assert.equal(typed.res.status, 503);
    assert.equal(typed.res.headers.get('retry-after'), '7');
    assert.equal(typed.json.error.retryAfter, 7);
  } finally {
    await api.close();
  }
});

test('the token never appears in any successful response body or header', async () => {
  const api = await startApi();
  try {
    for (const path of ['/api/genres', '/api/languages', '/api/movies/popular', '/api/movies/101', '/api/config/images']) {
      const { res, text } = await getJson(api.url + path);
      assert.ok(!text.includes(TEST_TOKEN), `${path} body leaked the token`);
      for (const [name, value] of res.headers) {
        assert.ok(!String(value).includes(TEST_TOKEN), `${path} header ${name} leaked the token`);
      }
    }
  } finally {
    await api.close();
  }
});
