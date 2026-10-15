import { isTransient } from './errors.js';

const STALE_GRACE_MS = 24 * 60 * 60 * 1000; // keep expired entries this long as an error fallback

/**
 * Small in-memory TTL cache with:
 *  - request de-duplication (concurrent callers share one upstream request)
 *  - stale-if-error (serve an expired copy if TMDB is rate-limiting or down)
 *  - a size cap (oldest entries are evicted first)
 */
export function createCache({ maxEntries = 500, now = () => Date.now() } = {}) {
  /** @type {Map<string, {value: unknown, expiresAt: number, staleUntil: number}>} */
  const store = new Map();
  /** @type {Map<string, Promise<unknown>>} */
  const inflight = new Map();

  function set(key, value, ttlMs) {
    store.delete(key); // re-insert so Map order = recency
    const t = now();
    store.set(key, { value, expiresAt: t + ttlMs, staleUntil: t + ttlMs + STALE_GRACE_MS });
    while (store.size > maxEntries) {
      store.delete(store.keys().next().value);
    }
  }

  /**
   * @template T
   * @param {string} key
   * @param {number} ttlMs
   * @param {() => Promise<T>} loader
   * @returns {Promise<T>}
   */
  async function remember(key, ttlMs, loader) {
    const t = now();
    const hit = store.get(key);

    if (hit && hit.expiresAt > t) return /** @type {T} */ (hit.value);
    if (hit && hit.staleUntil <= t) store.delete(key);

    const pending = inflight.get(key);
    if (pending) return /** @type {Promise<T>} */ (pending);

    const promise = (async () => {
      try {
        const value = await loader();
        set(key, value, ttlMs);
        return value;
      } catch (err) {
        const stale = store.get(key);
        if (stale && stale.staleUntil > now() && isTransient(err)) {
          return /** @type {T} */ (stale.value);
        }
        throw err;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, promise);
    return promise;
  }

  return {
    remember,
    clear: () => store.clear(),
    get size() {
      return store.size;
    },
  };
}

/** Stable cache key from a path + params object. */
export function cacheKey(path, params = {}) {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return `${path}?${sorted}`;
}
