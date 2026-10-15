/**
 * Error type used everywhere in the backend. Anything thrown as an HttpError is
 * turned into a clean JSON response; anything else becomes a generic 500 so that
 * internal details (and secrets) can never leak to the browser.
 */
export class HttpError extends Error {
  /**
   * @param {number} status  HTTP status returned to the client
   * @param {string} message Safe, human-readable message
   * @param {{code?: string, retryAfter?: number, cause?: unknown}} [options]
   */
  constructor(status, message, { code, retryAfter, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'HttpError';
    this.status = status;
    this.code = code || defaultCode(status);
    this.retryAfter = retryAfter;
  }
}

function defaultCode(status) {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 404: return 'NOT_FOUND';
    case 429: return 'RATE_LIMITED';
    case 502: return 'UPSTREAM_ERROR';
    case 503: return 'UNAVAILABLE';
    case 504: return 'UPSTREAM_TIMEOUT';
    default: return 'INTERNAL_ERROR';
  }
}

/** Errors worth falling back to a stale cached copy for. */
export function isTransient(err) {
  return err instanceof HttpError && [429, 502, 503, 504].includes(err.status);
}
