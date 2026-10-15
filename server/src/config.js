/**
 * Loads and validates configuration from environment variables.
 *
 * Secrets are read here and nowhere else. Error messages deliberately never
 * include the token value.
 */
export class ConfigError extends Error {
  constructor(problems) {
    super(`Invalid server configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

function readInt(env, name, fallback, { min, max }, problems) {
  const raw = env[name];
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    problems.push(`${name} must be a whole number between ${min} and ${max}.`);
    return fallback;
  }
  return n;
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function loadConfig(env = process.env) {
  const problems = [];

  const token = (env.TMDB_API_READ_ACCESS_TOKEN || '').trim();
  if (!token || /^your_/i.test(token)) {
    problems.push(
      'TMDB_API_READ_ACCESS_TOKEN is not set. Copy server/.env.example to server/.env and paste your ' +
        '"API Read Access Token" from https://www.themoviedb.org/settings/api'
    );
  } else if (/^[a-f0-9]{32}$/i.test(token)) {
    problems.push(
      'TMDB_API_READ_ACCESS_TOKEN looks like the short v3 "API Key". This server needs the long ' +
        '"API Read Access Token" (starts with "eyJ") from https://www.themoviedb.org/settings/api'
    );
  } else if (/\s/.test(token) || /^["']|["']$/.test(token)) {
    problems.push(
      'TMDB_API_READ_ACCESS_TOKEN contains spaces or quotes. Paste the bare token with no quotes.'
    );
  }

  const port = readInt(env, 'PORT', 4000, { min: 1, max: 65535 }, problems);
  const rateLimitPerMinute = readInt(env, 'RATE_LIMIT_PER_MINUTE', 120, { min: 1, max: 100000 }, problems);
  const timeoutMs = readInt(env, 'TMDB_TIMEOUT_MS', 10000, { min: 500, max: 60000 }, problems);

  const defaultLanguage = (env.TMDB_DEFAULT_LANGUAGE || 'en-US').trim();
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/.test(defaultLanguage)) {
    problems.push('TMDB_DEFAULT_LANGUAGE must look like "en-US" or "hi-IN".');
  }

  const corsOrigins = (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const tmdbBaseUrl = (env.TMDB_BASE_URL || 'https://api.themoviedb.org/3').trim().replace(/\/+$/, '');
  try {
    new URL(tmdbBaseUrl);
  } catch {
    problems.push('TMDB_BASE_URL must be a valid URL.');
  }

  if (problems.length) throw new ConfigError(problems);

  return Object.freeze({
    token,
    port,
    rateLimitPerMinute,
    timeoutMs,
    defaultLanguage,
    corsOrigins,
    tmdbBaseUrl,
  });
}
