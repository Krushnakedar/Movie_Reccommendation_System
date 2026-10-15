import { HttpError } from './errors.js';
import { MAX_TMDB_PAGES } from './normalize.js';

const bad = (message) => new HttpError(400, message, { code: 'INVALID_PARAMETER' });

/** Express can hand us arrays (?a=1&a=2). We only accept single values. */
function single(name, value) {
  if (Array.isArray(value)) throw bad(`"${name}" must be provided only once.`);
  if (value !== undefined && typeof value !== 'string') throw bad(`"${name}" must be a text value.`);
  return value;
}

const isBlank = (v) => v === undefined || v.trim() === '';

export function parsePage(value) {
  const v = single('page', value);
  if (isBlank(v)) return 1;
  if (!/^\d{1,4}$/.test(v.trim())) throw bad(`"page" must be a whole number between 1 and ${MAX_TMDB_PAGES}.`);
  const n = Number(v);
  if (n < 1 || n > MAX_TMDB_PAGES) throw bad(`"page" must be between 1 and ${MAX_TMDB_PAGES} (TMDB serves at most ${MAX_TMDB_PAGES} pages).`);
  return n;
}

export function parseMovieId(value) {
  const v = single('id', value);
  if (isBlank(v) || !/^\d{1,9}$/.test(v.trim()) || Number(v) < 1) {
    throw bad('Movie id must be a positive whole number.');
  }
  return Number(v);
}

export function parseSearchQuery(value) {
  const v = single('query', value);
  if (isBlank(v)) throw bad('"query" is required. Type at least one character to search.');
  const cleaned = v.trim().replace(/\s+/g, ' ');
  if (cleaned.length > 100) throw bad('"query" must be 100 characters or fewer.');
  return cleaned;
}

export function parseYear(name, value) {
  const v = single(name, value);
  if (isBlank(v)) return undefined;
  if (!/^\d{4}$/.test(v.trim())) throw bad(`"${name}" must be a 4-digit year.`);
  const n = Number(v);
  if (n < 1870 || n > 2100) throw bad(`"${name}" must be between 1870 and 2100.`);
  return n;
}

export function parseNumberInRange(name, value, min, max) {
  const v = single(name, value);
  if (isBlank(v)) return undefined;
  const n = Number(v);
  if (!/^\d+(\.\d+)?$/.test(v.trim()) || !Number.isFinite(n) || n < min || n > max) {
    throw bad(`"${name}" must be a number between ${min} and ${max}.`);
  }
  return n;
}

export function parseGenreIds(value) {
  const v = single('genres', value);
  if (isBlank(v)) return [];
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 10) throw bad('"genres" accepts at most 10 genre ids.');
  const ids = parts.map((p) => {
    if (!/^\d{1,6}$/.test(p)) throw bad('"genres" must be a comma-separated list of numeric genre ids, e.g. 28,12.');
    return Number(p);
  });
  return [...new Set(ids)];
}

export function parseGenreMode(value) {
  const v = single('genreMode', value);
  if (isBlank(v)) return 'or';
  const mode = v.trim().toLowerCase();
  if (mode !== 'or' && mode !== 'and') throw bad('"genreMode" must be "or" or "and".');
  return mode;
}

/** TMDB language codes are ISO 639-1 (2 letters), plus a few special ones like "cn" and "xx". */
export function parseLanguageCode(value) {
  const v = single('language', value);
  if (isBlank(v)) return undefined;
  const code = v.trim().toLowerCase();
  if (!/^[a-z]{2,3}$/.test(code)) throw bad('"language" must be a 2-letter language code such as "hi" or "en".');
  return code;
}

export const SORT_OPTIONS = Object.freeze([
  'popularity.desc',
  'popularity.asc',
  'vote_average.desc',
  'vote_average.asc',
  'vote_count.desc',
  'primary_release_date.desc',
  'primary_release_date.asc',
]);

export function parseSortBy(value) {
  const v = single('sortBy', value);
  if (isBlank(v)) return 'popularity.desc';
  const s = v.trim();
  if (!SORT_OPTIONS.includes(s)) throw bad(`"sortBy" must be one of: ${SORT_OPTIONS.join(', ')}.`);
  return s;
}

export function parseTimeWindow(value) {
  const v = single('window', value);
  if (isBlank(v)) return 'week';
  const w = v.trim().toLowerCase();
  if (w !== 'day' && w !== 'week') throw bad('"window" must be "day" or "week".');
  return w;
}

/** Validates everything /api/movies/discover accepts. */
export function parseDiscoverQuery(query = {}) {
  const yearFrom = parseYear('yearFrom', query.yearFrom);
  const yearTo = parseYear('yearTo', query.yearTo);
  if (yearFrom && yearTo && yearFrom > yearTo) throw bad('"yearFrom" cannot be later than "yearTo".');

  const minRating = parseNumberInRange('minRating', query.minRating, 0, 10);
  const maxRating = parseNumberInRange('maxRating', query.maxRating, 0, 10);
  if (minRating !== undefined && maxRating !== undefined && minRating > maxRating) {
    throw bad('"minRating" cannot be greater than "maxRating".');
  }

  const minVotes = parseNumberInRange('minVotes', query.minVotes, 0, 1_000_000);

  return {
    page: parsePage(query.page),
    genres: parseGenreIds(query.genres),
    genreMode: parseGenreMode(query.genreMode),
    language: parseLanguageCode(query.language),
    minRating,
    maxRating,
    minVotes: minVotes === undefined ? undefined : Math.floor(minVotes),
    yearFrom,
    yearTo,
    sortBy: parseSortBy(query.sortBy),
  };
}
