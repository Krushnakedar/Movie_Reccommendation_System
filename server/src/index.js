import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { createCache } from './cache.js';
import { createCatalog } from './catalog.js';
import { ConfigError, loadConfig } from './config.js';
import { buildRoutes } from './routes.js';
import { createTmdbClient } from './tmdbClient.js';

// Always load server/.env, no matter which directory the process was started from.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }
  throw err;
}

const tmdb = createTmdbClient({
  baseUrl: config.tmdbBaseUrl,
  token: config.token,
  timeoutMs: config.timeoutMs,
});
const cache = createCache({ maxEntries: 500 });
const catalog = createCatalog({ tmdb, cache, config });
const app = createApp({ config, routes: buildRoutes(catalog) });

const server = app.listen(config.port, () => {
  console.log(`CineMatch API listening on http://localhost:${config.port}  (TMDB token loaded)`);

  // Check the token + prefetch rarely-changing data (genres, languages, image config).
  catalog.warmUp().then((results) => {
    const failed = results.find((r) => r.status === 'rejected');
    if (!failed) {
      console.log('TMDB connection OK: genres, languages and image configuration loaded.');
    } else if (failed.reason?.code === 'TMDB_AUTH') {
      console.error(
        'TMDB rejected the token. Open server/.env and make sure TMDB_API_READ_ACCESS_TOKEN is the ' +
          '"API Read Access Token" from https://www.themoviedb.org/settings/api'
      );
    } else {
      console.warn(`Could not reach TMDB yet (${failed.reason?.message}). Requests will retry on demand.`);
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Change PORT in server/.env (and the Vite proxy target) or stop the other process.`);
  } else {
    console.error(`Server failed to start: ${err.message}`);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`Unhandled promise rejection: ${reason?.message || reason}`);
});
