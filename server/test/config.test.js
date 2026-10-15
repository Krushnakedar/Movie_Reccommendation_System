import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigError, loadConfig } from '../src/config.js';

const JWT_LIKE = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ0ZXN0In0.c2lnbmF0dXJl';

test('loadConfig accepts a bearer-style token and applies defaults', () => {
  const config = loadConfig({ TMDB_API_READ_ACCESS_TOKEN: JWT_LIKE });
  assert.equal(config.token, JWT_LIKE);
  assert.equal(config.port, 4000);
  assert.equal(config.defaultLanguage, 'en-US');
  assert.equal(config.tmdbBaseUrl, 'https://api.themoviedb.org/3');
  assert.deepEqual(config.corsOrigins, ['http://localhost:5173', 'http://127.0.0.1:5173']);
});

test('loadConfig rejects a missing, blank, or placeholder token', () => {
  for (const value of [undefined, '', '   ', 'your_tmdb_api_read_access_token_here']) {
    assert.throws(() => loadConfig({ TMDB_API_READ_ACCESS_TOKEN: value }), ConfigError);
  }
});

test('loadConfig explains when the short v3 API key is used by mistake', () => {
  const v3Key = 'a'.repeat(32);
  assert.throws(
    () => loadConfig({ TMDB_API_READ_ACCESS_TOKEN: v3Key }),
    (err) => err instanceof ConfigError && /API Read Access Token/.test(err.message)
  );
});

test('config errors never contain the token value', () => {
  const secret = 'eyJ-secret value with spaces';
  try {
    loadConfig({ TMDB_API_READ_ACCESS_TOKEN: secret });
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err instanceof ConfigError);
    assert.ok(!err.message.includes(secret));
  }
});

test('loadConfig validates PORT and language', () => {
  assert.throws(() => loadConfig({ TMDB_API_READ_ACCESS_TOKEN: JWT_LIKE, PORT: 'abc' }), ConfigError);
  assert.throws(() => loadConfig({ TMDB_API_READ_ACCESS_TOKEN: JWT_LIKE, TMDB_DEFAULT_LANGUAGE: 'english' }), ConfigError);
});
