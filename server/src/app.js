import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { HttpError } from './errors.js';

const errorBody = (status, code, message, extra = {}) => ({ error: { status, code, message, ...extra } });

/**
 * @param {object} deps
 * @param {{corsOrigins: string[], rateLimitPerMinute: number}} deps.config
 * @param {ReturnType<import('./routes.js').buildRoutes>} deps.routes
 */
export function createApp({ config, routes, logger = console }) {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ['GET', 'HEAD', 'OPTIONS'],
      maxAge: 600,
    })
  );

  // Protects the TMDB token/quota from a misbehaving client. This is separate from (and in front of)
  // the handling of 429 responses coming back from TMDB itself.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: config.rateLimitPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res) => {
        const resetTime = req.rateLimit?.resetTime;
        const retryAfter = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : 60;
        res.set('Retry-After', String(retryAfter));
        res
          .status(429)
          .json(errorBody(429, 'RATE_LIMITED', `Too many requests. Please wait ${retryAfter} seconds and try again.`, { retryAfter }));
      },
    })
  );

  const api = express.Router();
  for (const route of routes) {
    api.get(route.path, async (req, res, next) => {
      try {
        const data = await route.handler({ query: req.query, params: req.params });
        res.set('Cache-Control', route.maxAge ? `public, max-age=${route.maxAge}` : 'no-store');
        res.json(data);
      } catch (err) {
        next(err);
      }
    });
  }
  app.use('/api', api);

  // Unknown /api paths
  app.use('/api', (req, res) => {
    res.status(404).json(errorBody(404, 'NOT_FOUND', `No API route matches ${req.method} ${req.path}.`));
  });

  // Central error handler. Only HttpError messages are shown to clients.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof HttpError) {
      if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
      return res
        .status(err.status)
        .json(errorBody(err.status, err.code, err.message, err.retryAfter ? { retryAfter: err.retryAfter } : {}));
    }

    logger.error(`[server] unexpected error on ${req.method} ${req.path}: ${err?.message || err}`);
    return res.status(500).json(errorBody(500, 'INTERNAL_ERROR', 'Something went wrong on the server. Please try again.'));
  });

  return app;
}
