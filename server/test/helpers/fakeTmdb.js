import http from 'node:http';

/**
 * A tiny local stand-in for api.themoviedb.org used ONLY by the automated tests.
 * It mimics the documented response shapes and enforces Bearer authentication,
 * so we can test our client/cache/normalizer without a network or a real token.
 * It does not prove anything about the live TMDB service -- use `npm run smoke` for that.
 */

export const TEST_TOKEN = 'test-token-not-a-real-secret';

const IMAGES = {
  images: {
    secure_base_url: 'https://image.tmdb.org/t/p/',
    poster_sizes: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
    backdrop_sizes: ['w300', 'w780', 'w1280', 'original'],
    profile_sizes: ['w45', 'w185', 'h632', 'original'],
  },
};

const GENRES = {
  genres: [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 18, name: 'Drama' },
    { id: 878, name: 'Science Fiction' },
  ],
};

// Includes unusual entries on purpose: "xx" (No Language), an entry with a blank english_name.
const LANGUAGES = [
  { iso_639_1: 'te', english_name: 'Telugu', name: 'తెలుగు' },
  { iso_639_1: 'hi', english_name: 'Hindi', name: 'हिन्दी' },
  { iso_639_1: 'en', english_name: 'English', name: 'English' },
  { iso_639_1: 'mr', english_name: 'Marathi', name: 'मराठी' },
  { iso_639_1: 'xx', english_name: 'No Language', name: 'No Language' },
  { iso_639_1: 'ab', english_name: '', name: 'Аҧсуа' },
  { iso_639_1: 'cn', english_name: 'Cantonese', name: '广州话 / 廣州話' },
];

export const FIXTURE_MOVIES = [
  {
    id: 101,
    title: 'Fixture Movie One',
    original_title: 'Fixture Movie One',
    overview: '  A fixture overview.  ',
    poster_path: '/poster101.jpg',
    backdrop_path: '/backdrop101.jpg',
    release_date: '2024-05-01',
    vote_average: 8.2567,
    vote_count: 1234,
    popularity: 99.5,
    genre_ids: [28, 12],
    original_language: 'en',
  },
  {
    // Deliberately sparse: no poster, no backdrop, no overview, no release date, never rated.
    id: 102,
    title: '',
    original_title: 'Sparse Original Title',
    overview: '',
    poster_path: null,
    backdrop_path: null,
    release_date: '',
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    original_language: 'mr',
  },
];

const pageOf = (results, page = 1) => ({ page: Number(page), results, total_pages: 9999, total_results: 199980 });

const DETAILS = {
  ...FIXTURE_MOVIES[0],
  genres: [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
  ],
  runtime: 125,
  tagline: 'A fixture tagline',
  status: 'Released',
  homepage: 'https://example.com/fixture',
  credits: {
    cast: [
      { name: 'Actor One' },
      { name: 'Actor Two' },
      { name: 'Actor One' }, // duplicate on purpose
    ],
    crew: [
      { name: 'Director Person', job: 'Director' },
      { name: 'Writer Person', job: 'Writer' },
    ],
  },
  videos: {
    results: [
      { site: 'Vimeo', type: 'Trailer', key: 'vimeo123456', official: true },
      { site: 'YouTube', type: 'Clip', key: 'clipKey12345', official: true },
      { site: 'YouTube', type: 'Trailer', key: 'trailerKey01', official: true, name: 'Official Trailer' },
      { site: 'YouTube', type: 'Trailer', key: '<script>bad', official: true },
    ],
  },
};

/**
 * @returns {Promise<{baseUrl: string, hits: Array<{path: string, params: Record<string,string>, auth?: string}>, setHook: (fn: Function|null) => void, close: () => Promise<void>}>}
 */
export async function startFakeTmdb({ token = TEST_TOKEN } = {}) {
  const hits = [];
  let hook = null;

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fake');
    const params = Object.fromEntries(url.searchParams);
    const path = url.pathname.replace(/^\/3/, '');
    hits.push({ path, params, auth: req.headers.authorization });

    if (req.headers.authorization !== `Bearer ${token}`) {
      return send(res, 401, { status_code: 7, status_message: 'Invalid API key: You must be granted a valid key.', success: false });
    }

    if (hook) {
      const handled = hook({ path, params, res, send });
      if (handled) return;
    }

    if (path === '/configuration') return send(res, 200, IMAGES);
    if (path === '/configuration/languages') return send(res, 200, LANGUAGES);
    if (path === '/genre/movie/list') return send(res, 200, GENRES);
    if (['/movie/popular', '/movie/top_rated', '/movie/upcoming', '/search/movie', '/discover/movie'].includes(path) || path.startsWith('/trending/movie/')) {
      return send(res, 200, pageOf(FIXTURE_MOVIES, params.page));
    }
    const m = /^\/movie\/(\d+)$/.exec(path);
    if (m) {
      return Number(m[1]) === 101
        ? send(res, 200, DETAILS)
        : send(res, 404, { status_code: 34, status_message: 'The resource you requested could not be found.', success: false });
    }
    return send(res, 404, { status_code: 34, status_message: 'Not found', success: false });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}/3`,
    hits,
    setHook: (fn) => {
      hook = fn;
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

export const silentLogger = { info() {}, warn() {}, error() {} };
