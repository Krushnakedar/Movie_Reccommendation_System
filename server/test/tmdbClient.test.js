import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { HttpError } from '../src/errors.js';
import { createTmdbClient } from '../src/tmdbClient.js';
import { silentLogger, startFakeTmdb, TEST_TOKEN } from './helpers/fakeTmdb.js';

let fake;
before(async () => {
  fake = await startFakeTmdb();
});
after(async () => {
  await fake.close();
});

const makeClient = (overrides = {}) =>
  createTmdbClient({
    baseUrl: fake.baseUrl,
    token: TEST_TOKEN,
    sleep: async () => {},
    logger: silentLogger,
    ...overrides,
  });

const rejectsWith = async (promise, status, code) => {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof HttpError, `expected HttpError, got ${err}`);
    assert.equal(err.status, status);
    if (code) assert.equal(err.code, code);
    return true;
  });
};

test('sends the token as a Bearer Authorization header and drops empty params', async () => {
  fake.hits.length = 0;
  const data = await makeClient().get('/genre/movie/list', { language: 'en-US', page: undefined, empty: '', flag: false });
  assert.equal(data.genres.length, 4);
  const hit = fake.hits.at(-1);
  assert.equal(hit.auth, `Bearer ${TEST_TOKEN}`);
  assert.equal(hit.params.language, 'en-US');
  assert.equal(hit.params.flag, 'false');
  assert.ok(!('page' in hit.params) && !('empty' in hit.params));
  assert.ok(!('api_key' in hit.params), 'the token must never be sent as a query parameter');
});

test('a wrong token becomes a safe 502 TMDB_AUTH error that does not echo the token', async () => {
  const client = makeClient({ token: 'wrong-token-value' });
  await assert.rejects(client.get('/genre/movie/list'), (err) => {
    assert.equal(err.status, 502);
    assert.equal(err.code, 'TMDB_AUTH');
    assert.ok(!err.message.includes('wrong-token-value'));
    return true;
  });
});

test('404 from TMDB becomes a 404', async () => {
  await rejectsWith(makeClient().get('/movie/999'), 404, 'NOT_FOUND');
});

test('429 is retried honouring Retry-After and then succeeds', async () => {
  let calls = 0;
  const sleeps = [];
  fake.setHook(({ path, res }) => {
    if (path !== '/genre/movie/list') return false;
    calls += 1;
    if (calls <= 2) {
      res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '2' });
      res.end(JSON.stringify({ status_code: 25, status_message: 'Your request count is over the allowed limit.' }));
      return true;
    }
    return false;
  });
  const data = await makeClient({ sleep: async (ms) => sleeps.push(ms) }).get('/genre/movie/list');
  fake.setHook(null);
  assert.equal(data.genres.length, 4);
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [2000, 2000]);
});

test('persistent 429 gives up with a 429 HttpError carrying retryAfter', async () => {
  fake.setHook(({ res }) => {
    res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '30' });
    res.end('{}');
    return true;
  });
  await assert.rejects(makeClient().get('/genre/movie/list'), (err) => {
    assert.equal(err.status, 429);
    assert.equal(err.retryAfter, 30);
    assert.match(err.message, /30 seconds/);
    return true;
  });
  fake.setHook(null);
});

test('5xx is retried and then reported as 502', async () => {
  let calls = 0;
  fake.setHook(({ res }) => {
    calls += 1;
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end('{}');
    return true;
  });
  await rejectsWith(makeClient({ maxRetries: 2 }).get('/genre/movie/list'), 502, 'UPSTREAM_ERROR');
  assert.equal(calls, 3); // 1 attempt + 2 retries
  fake.setHook(null);
});

test('a hanging TMDB request times out as 504', async () => {
  fake.setHook(() => true); // never responds
  await rejectsWith(makeClient({ timeoutMs: 80, maxRetries: 0 }).get('/genre/movie/list'), 504, 'UPSTREAM_TIMEOUT');
  fake.setHook(null);
});

test('network failure becomes 502 UPSTREAM_UNREACHABLE', async () => {
  const client = createTmdbClient({
    baseUrl: 'http://127.0.0.1:1/3', // nothing listens on port 1
    token: TEST_TOKEN,
    maxRetries: 0,
    sleep: async () => {},
    logger: silentLogger,
  });
  await rejectsWith(client.get('/genre/movie/list'), 502, 'UPSTREAM_UNREACHABLE');
});

test('logger output never contains the token', async () => {
  const lines = [];
  const logger = { info: (m) => lines.push(m), warn: (m) => lines.push(m), error: (m) => lines.push(m) };
  await makeClient({ token: 'secret-should-not-appear', logger }).get('/genre/movie/list').catch(() => {});
  assert.ok(lines.length > 0);
  assert.ok(lines.every((l) => !String(l).includes('secret-should-not-appear')));
});
