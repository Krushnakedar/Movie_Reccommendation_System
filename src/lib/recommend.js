/**
 * Rule-based recommendation algorithm (from the practical report).
 *
 * Inputs : one genre, an optional original language, a minimum rating.
 * Step 1 : ask TMDB for movies that satisfy ALL THREE filters and rank them by TMDB rating
 *          (highest first). Show up to INITIAL_VISIBLE (3) of them.
 * Step 2 : if no movie satisfies all three filters, fall back to movies of the selected genre only
 *          (still ranked by TMDB rating) and say clearly that these do NOT meet the other filters.
 *
 * This is a deterministic, rule-based ranking (filter + sort on TMDB rating and vote count).
 * It is NOT a trained machine-learning model.
 *
 * This file has no browser or network dependencies: the caller injects `discover(query)`, which
 * must resolve to the backend page shape { page, totalPages, totalResults, results }.
 */

export const INITIAL_VISIBLE = 3;
export const PAGE_STEP = 3;
/** Ranking rule: highest TMDB rating first (the backend also enforces a minimum vote count). */
export const RANK_SORT = 'vote_average.desc';

/** Query for movies matching genre + language + minimum rating. */
export function exactQuery({ genreId, language, minRating }, page = 1) {
  return {
    genres: String(genreId),
    language: language || undefined,
    minRating: minRating > 0 ? minRating : undefined,
    sortBy: RANK_SORT,
    page,
  };
}

/** Query for the fallback: the selected genre only. */
export function fallbackQuery({ genreId }, page = 1) {
  return { genres: String(genreId), sortBy: RANK_SORT, page };
}

/** Defensive check so an "exact match" is never shown unless it really satisfies every filter. */
export function matchesCriteria(movie, { genreId, language, minRating }) {
  if (!Array.isArray(movie.genreIds) || !movie.genreIds.includes(genreId)) return false;
  if (language && movie.language !== language) return false;
  if (minRating > 0 && !(typeof movie.rating === 'number' && movie.rating >= minRating)) return false;
  return true;
}

/**
 * Lists, in plain words, which of the selected filters a fallback movie does NOT meet.
 * Returns an empty array when the movie satisfies every filter.
 */
export function describeMismatches(movie, { genreId, language, minRating }, { languageName } = {}) {
  const reasons = [];
  if (!Array.isArray(movie.genreIds) || !movie.genreIds.includes(genreId)) {
    reasons.push('Different genre');
  }
  if (language && movie.language !== language) {
    const actual = movie.languageName || (movie.language ? movie.language.toUpperCase() : 'unknown language');
    reasons.push(`Language: ${actual} (you chose ${languageName || language.toUpperCase()})`);
  }
  if (minRating > 0) {
    if (typeof movie.rating !== 'number') reasons.push('No TMDB rating yet');
    else if (movie.rating < minRating) {
      reasons.push(`Rating ${movie.rating.toFixed(1)} is below ${Number(minRating).toFixed(1)}`);
    }
  }
  return reasons;
}

function mergeUnique(existing, incoming) {
  const seen = new Set(existing.map((m) => m.id));
  return [...existing, ...incoming.filter((m) => !seen.has(m.id))];
}

/**
 * @param {{genreId: number, language?: string, minRating?: number}} criteria
 * @param {(query: object) => Promise<{page: number, totalPages: number, totalResults: number, results: object[]}>} discover
 * @returns {Promise<{mode: 'exact'|'fallback'|'none', movies: object[], page: number, totalPages: number, totalMatches: number}>}
 */
export async function runRecommendation(criteria, discover) {
  const exactPage = await discover(exactQuery(criteria));
  const exact = exactPage.results.filter((m) => matchesCriteria(m, criteria));
  if (exact.length > 0) {
    return {
      mode: 'exact',
      movies: mergeUnique([], exact),
      page: exactPage.page,
      totalPages: exactPage.totalPages,
      totalMatches: exactPage.totalResults,
    };
  }

  const fallbackPage = await discover(fallbackQuery(criteria));
  if (fallbackPage.results.length > 0) {
    return {
      mode: 'fallback',
      movies: mergeUnique([], fallbackPage.results),
      page: fallbackPage.page,
      totalPages: fallbackPage.totalPages,
      totalMatches: fallbackPage.totalResults,
    };
  }

  return { mode: 'none', movies: [], page: 1, totalPages: 0, totalMatches: 0 };
}

export const canLoadMore = (outcome) => outcome.mode !== 'none' && outcome.page < outcome.totalPages;

/** Fetches the next TMDB page for the mode that is currently being shown. */
export async function loadMoreRecommendations(outcome, criteria, discover) {
  const page = outcome.page + 1;
  const res = await discover(outcome.mode === 'exact' ? exactQuery(criteria, page) : fallbackQuery(criteria, page));
  const incoming = outcome.mode === 'exact' ? res.results.filter((m) => matchesCriteria(m, criteria)) : res.results;
  return {
    ...outcome,
    movies: mergeUnique(outcome.movies, incoming),
    page: res.page,
    totalPages: res.totalPages,
  };
}

/** Human-readable summary of the selected filters, e.g. "Genre: Action · Language: Hindi · Min rating: 7.0+". */
export function describeCriteria({ language, minRating }, { genreName, languageName }) {
  return [
    `Genre: ${genreName || 'Unknown'}`,
    `Language: ${language ? languageName || language.toUpperCase() : 'Any'}`,
    `Min rating: ${minRating > 0 ? `${Number(minRating).toFixed(1)}+` : 'Any'}`,
  ].join(' · ');
}
