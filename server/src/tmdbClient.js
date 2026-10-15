import { HttpError } from './errors.js';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Minimal TMDB v3 client.
 *
 * - Authenticates with `Authorization: Bearer <API Read Access Token>` (server-side only).
 * - Times out slow requests.
 * - Respects HTTP 429 (honours Retry-After) and retries transient 5xx / network errors
 *   with exponential backoff.
 * - Converts every failure to an HttpError with a safe, useful message.
 * - Never logs the token, request headers, or query strings.
 *
 * @param {object} options
 * @param {string} options.baseUrl
 * @param {string} options.token
 */
export function createTmdbClient({
  baseUrl,
  token,
  timeoutMs = 10_000,
  maxRetries = 2,
  maxRetryAfterMs = 5_000,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  logger = console,
}) {
  if (!token) throw new Error('createTmdbClient: a token is required');
  const base = baseUrl.replace(/\/+$/, '');
  const backoff = (attempt) => 300 * 2 ** (attempt - 1);

  /**
   * @param {string} path   e.g. "/movie/popular"
   * @param {Record<string, string | number | boolean | undefined | null>} [params]
   */
  async function get(path, params = {}) {
    const url = new URL(base + path);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    let attempt = 0;
    for (;;) {
      let res;
      try {
        res = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
        if (attempt < maxRetries) {
          attempt += 1;
          await sleep(backoff(attempt));
          continue;
        }
        logger.warn(`[tmdb] ${timedOut ? 'timeout' : 'network error'} calling ${path}`);
        throw new HttpError(
          timedOut ? 504 : 502,
          timedOut
            ? 'TMDB took too long to respond. Please try again in a moment.'
            : 'Could not reach TMDB. Check your internet connection and try again.',
          { code: timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE' }
        );
      }

      if (res.ok) {
        try {
          return await res.json();
        } catch {
          throw new HttpError(502, 'TMDB returned a response that could not be read.', {
            code: 'UPSTREAM_BAD_RESPONSE',
          });
        }
      }

      const body = await res.json().catch(() => null);
      const upstreamMessage =
        typeof body?.status_message === 'string' ? body.status_message.slice(0, 200) : undefined;

      if (res.status === 429) {
        const header = Number(res.headers.get('retry-after'));
        const retryAfterSec = Number.isFinite(header) && header > 0 ? Math.ceil(header) : undefined;
        const waitMs = retryAfterSec ? retryAfterSec * 1000 : backoff(attempt + 1);
        if (attempt < maxRetries && waitMs <= maxRetryAfterMs) {
          attempt += 1;
          await sleep(waitMs);
          continue;
        }
        logger.warn(`[tmdb] 429 rate limited on ${path}`);
        throw new HttpError(
          429,
          retryAfterSec
            ? `TMDB is rate limiting requests. Please retry in about ${retryAfterSec} second${retryAfterSec === 1 ? '' : 's'}.`
            : 'TMDB is rate limiting requests. Please retry in a few seconds.',
          { code: 'UPSTREAM_RATE_LIMITED', retryAfter: retryAfterSec ?? 5 }
        );
      }

      if (res.status === 401 || res.status === 403) {
        logger.error(
          `[tmdb] ${res.status} on ${path}: TMDB rejected the server credentials. ` +
            'Check TMDB_API_READ_ACCESS_TOKEN in server/.env (it must be the "API Read Access Token").'
        );
        throw new HttpError(
          502,
          'The server could not authenticate with TMDB. The server administrator must check the TMDB token configuration.',
          { code: 'TMDB_AUTH' }
        );
      }

      if (res.status === 404) {
        throw new HttpError(404, 'TMDB could not find the requested item.', { code: 'NOT_FOUND' });
      }

      if (res.status === 400 || res.status === 422) {
        throw new HttpError(400, `TMDB rejected the request${upstreamMessage ? `: ${upstreamMessage}` : '.'}`, {
          code: 'UPSTREAM_REJECTED',
        });
      }

      if (res.status >= 500 && attempt < maxRetries) {
        attempt += 1;
        await sleep(backoff(attempt));
        continue;
      }

      logger.warn(`[tmdb] unexpected status ${res.status} on ${path}`);
      throw new HttpError(502, 'TMDB is temporarily unavailable. Please try again shortly.', {
        code: 'UPSTREAM_ERROR',
      });
    }
  }

  return { get };
}
