#!/usr/bin/env node
/**
 * Live smoke test: `npm run smoke`  (run from the server/ folder)
 *
 * What it does
 *   Starts the real CineMatch API in-process on a random local port, using the TMDB token from
 *   server/.env, then calls every endpoint over HTTP and checks the response contract. This is the
 *   only check in the project that talks to the REAL TMDB service.
 *
 * What it never does
 *   - It never prints the token.
 *   - It never reports success for a check that did not run. If no token is configured it says so
 *     and exits with code 2 ("skipped"), not 0.
 *
 * Exit codes: 0 = all checks passed against live TMDB, 1 = at least one check failed,
 *             2 = not run (token missing/invalid format).
 *
 * Optional: `node scripts/smoke.js --url http://localhost:4000` tests an already running server
 * instead (the token is then not needed by this script).
 */
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from '../src/app.js';
import { createCache } from '../src/cache.js';
import { createCatalog } from '../src/catalog.js';
import { ConfigError, loadConfig } from '../src/config.js';
import { buildRoutes } from '../src/routes.js';
import { createTmdbClient } from '../src/tmdbClient.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const urlFlag = process.argv.indexOf('--url');
const externalUrl = urlFlag > -1 ? process.argv[urlFlag + 1] : null;

const results = [];
let upstreamLabel = 'live TMDB'; // adjusted below when we can tell it is NOT the real TMDB
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ${green('PASS')}  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, reason: err.message });
    console.log(`  ${red('FAIL')}  ${name}\n        ${err.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  let base = externalUrl;
  let server = null;

  if (!base) {
    let config;
    try {
      config = loadConfig();
    } catch (err) {
      if (err instanceof ConfigError) {
        console.log(yellow('\nSMOKE TEST NOT RUN: no usable TMDB token is configured.\n'));
        console.log(err.message);
        console.log('\nNothing was tested against TMDB. Fix server/.env and run `npm run smoke` again.\n');
        process.exit(2);
      }
      throw err;
    }
    const isRealTmdb = new URL(config.tmdbBaseUrl).host === 'api.themoviedb.org';
    if (!isRealTmdb) upstreamLabel = `a STUB at ${new URL(config.tmdbBaseUrl).host} (TMDB_BASE_URL override) -- NOT live TMDB`;
    const tmdb = createTmdbClient({ baseUrl: config.tmdbBaseUrl, token: config.token, timeoutMs: config.timeoutMs });
    const catalog = createCatalog({ tmdb, cache: createCache(), config });
    const app = createApp({ config: { ...config, rateLimitPerMinute: 1000 }, routes: buildRoutes(catalog) });
    server = await new Promise((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
      s.on('error', reject);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  }

  if (externalUrl) upstreamLabel = 'whatever TMDB the running server at that URL is configured with';
  console.log(`\nCineMatch smoke test: ${externalUrl ? externalUrl : 'in-process API'} -> ${upstreamLabel}\n`);

  const get = async (path) => {
    const res = await fetch(base + path, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* leave null */
    }
    return { status: res.status, json, headers: res.headers };
  };

  const expectMovie = (m, where) => {
    expect(Number.isInteger(m.id), `${where}: movie.id must be an integer`);
    expect(typeof m.title === 'string' && m.title.length > 0, `${where}: movie.title must be a non-empty string`);
    expect(m.poster === null || /^https:\/\/image\.tmdb\.org\//.test(m.poster), `${where}: poster must be null or an image.tmdb.org URL (got ${m.poster})`);
    expect(m.rating === null || (typeof m.rating === 'number' && m.rating >= 0 && m.rating <= 10), `${where}: rating must be null or 0-10`);
    expect(Array.isArray(m.genre), `${where}: genre must be an array`);
    expect(m.ratingSource === 'TMDB', `${where}: ratingSource must be "TMDB"`);
  };

  const expectPage = (r, where) => {
    expect(r.status === 200, `${where}: expected HTTP 200, got ${r.status} ${r.json?.error?.message || ''}`);
    expect(Array.isArray(r.json.results) && r.json.results.length > 0, `${where}: expected at least one result`);
    expect(r.json.totalPages >= 1 && r.json.totalPages <= 500, `${where}: totalPages must be 1..500`);
    r.json.results.slice(0, 5).forEach((m) => expectMovie(m, where));
  };

  let firstMovieId = null;

  await check('GET /api/health?deep=true verifies the TMDB token', async () => {
    const r = await get('/api/health?deep=true');
    expect(r.status === 200, `HTTP ${r.status}: ${r.json?.error?.message || 'no body'}`);
    expect(r.json.tmdb === 'ok', 'deep health did not report tmdb: ok');
  });

  await check('GET /api/genres returns TMDB genres (includes Action = 28)', async () => {
    const r = await get('/api/genres');
    expect(r.status === 200, `HTTP ${r.status}`);
    expect(r.json.genres.length >= 10, `only ${r.json.genres.length} genres`);
    expect(r.json.genres.some((g) => g.id === 28), 'Action (28) missing');
  });

  await check('GET /api/languages returns the full TMDB language list (includes en, hi, mr)', async () => {
    const r = await get('/api/languages');
    expect(r.status === 200, `HTTP ${r.status}`);
    expect(r.json.count >= 50, `only ${r.json.count} languages`);
    for (const code of ['en', 'hi', 'mr']) expect(r.json.languages.some((l) => l.code === code), `"${code}" missing`);
    console.log(`        (${r.json.count} languages returned by TMDB)`);
  });

  for (const [label, path] of [
    ['trending', '/api/movies/trending?window=week'],
    ['popular', '/api/movies/popular'],
    ['top-rated', '/api/movies/top-rated'],
    ['upcoming', '/api/movies/upcoming'],
  ]) {
    await check(`GET ${path} returns movies`, async () => {
      const r = await get(path);
      expectPage(r, label);
      if (label === 'popular') firstMovieId = r.json.results[0].id;
    });
  }

  await check('Pagination: popular page 2 differs from page 1', async () => {
    const [p1, p2] = await Promise.all([get('/api/movies/popular?page=1'), get('/api/movies/popular?page=2')]);
    expectPage(p2, 'popular page 2');
    expect(p2.json.page === 2, 'page 2 not echoed');
    expect(p1.json.results[0].id !== p2.json.results[0].id, 'page 1 and 2 start with the same movie');
  });

  await check('GET /api/movies/search?query=inception finds results', async () => {
    expectPage(await get('/api/movies/search?query=inception'), 'search');
  });

  await check('GET /api/movies/discover with genre + language + min rating (Hindi action, 6+)', async () => {
    const r = await get('/api/movies/discover?genres=28&language=hi&minRating=6');
    expect(r.status === 200, `HTTP ${r.status} ${r.json?.error?.message || ''}`);
    expect(Array.isArray(r.json.results), 'results missing');
    r.json.results.forEach((m) => {
      expect(m.language === 'hi', `got language "${m.language}" for "${m.title}"`);
      expect(m.rating === null || m.rating >= 6, `"${m.title}" rated ${m.rating} < 6`);
      expect(m.genreIds.includes(28), `"${m.title}" is not Action`);
    });
    console.log(`        (${r.json.totalResults} matches, ${r.json.results.length} on this page)`);
  });

  await check('GET /api/movies/:id returns details (cast, genres, runtime)', async () => {
    expect(firstMovieId, 'no movie id available (popular check failed)');
    const r = await get(`/api/movies/${firstMovieId}`);
    expect(r.status === 200, `HTTP ${r.status}`);
    expectMovie(r.json, 'details');
    expect(Array.isArray(r.json.cast), 'cast must be an array');
  });

  await check('Validation: empty search -> 400, bad id -> 400, bad page -> 400', async () => {
    expect((await get('/api/movies/search?query=')).status === 400, 'empty search was not rejected');
    expect((await get('/api/movies/abc')).status === 400, 'non-numeric id was not rejected');
    expect((await get('/api/movies/popular?page=9999')).status === 400, 'page 9999 was not rejected');
  });

  await check('Unknown API route -> 404 JSON', async () => {
    const r = await get('/api/does-not-exist');
    expect(r.status === 404 && r.json?.error?.code === 'NOT_FOUND', `got ${r.status}`);
  });

  if (server) await new Promise((resolve) => server.close(resolve));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${upstreamLabel}.`);
  if (failed.length) {
    console.log(red('Smoke test FAILED.'));
    process.exit(1);
  }
  console.log(
    upstreamLabel === 'live TMDB'
      ? green('Smoke test PASSED. Live TMDB connectivity verified.')
      : yellow(`Smoke test passed, but this was ${upstreamLabel}; live TMDB connectivity was NOT verified.`)
  );
}

main().catch((err) => {
  console.error(red(`Smoke test crashed: ${err.message}`));
  process.exit(1);
});
