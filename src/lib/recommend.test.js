// Run with:  npm run test:frontend   (uses Node's built-in test runner; no extra dependencies)
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_VISIBLE,
  canLoadMore,
  describeCriteria,
  describeMismatches,
  exactQuery,
  fallbackQuery,
  loadMoreRecommendations,
  matchesCriteria,
  runRecommendation,
} from './recommend.js';

// Fixtures used ONLY by these isolated tests. They are never shown in the app.
const movie = (id, over = {}) => ({ id, title: `Movie ${id}`, genreIds: [28], language: 'hi', rating: 7.5, ...over });
const page = (results, over = {}) => ({ page: 1, totalPages: 1, totalResults: results.length, results, ...over });

const criteria = { genreId: 28, language: 'hi', minRating: 7 };

test('exactQuery sends genre, language, min rating and the rating-based ranking rule', () => {
  assert.deepEqual(exactQuery(criteria), {
    genres: '28',
    language: 'hi',
    minRating: 7,
    sortBy: 'vote_average.desc',
    page: 1,
  });
});

test('exactQuery omits language and rating when they are "any"', () => {
  const q = exactQuery({ genreId: 35, language: '', minRating: 0 }, 2);
  assert.equal(q.language, undefined);
  assert.equal(q.minRating, undefined);
  assert.equal(q.page, 2);
});

test('fallbackQuery uses the genre only', () => {
  assert.deepEqual(fallbackQuery(criteria), { genres: '28', sortBy: 'vote_average.desc', page: 1 });
});

test('matchesCriteria checks genre, language and rating', () => {
  assert.equal(matchesCriteria(movie(1), criteria), true);
  assert.equal(matchesCriteria(movie(2, { genreIds: [35] }), criteria), false);
  assert.equal(matchesCriteria(movie(3, { language: 'en' }), criteria), false);
  assert.equal(matchesCriteria(movie(4, { rating: 6.9 }), criteria), false);
  assert.equal(matchesCriteria(movie(5, { rating: null }), criteria), false);
  assert.equal(matchesCriteria(movie(6, { rating: null }), { genreId: 28, language: '', minRating: 0 }), true);
});

test('exact matches are returned as "exact" and the fallback is never requested', async () => {
  const calls = [];
  const outcome = await runRecommendation(criteria, async (q) => {
    calls.push(q);
    return page([movie(1), movie(2), movie(3), movie(4)], { totalResults: 4 });
  });
  assert.equal(outcome.mode, 'exact');
  assert.equal(outcome.movies.length, 4);
  assert.equal(calls.length, 1);
  assert.ok(INITIAL_VISIBLE === 3);
});

test('no exact match falls back to the genre only and says so', async () => {
  const calls = [];
  const outcome = await runRecommendation(criteria, async (q) => {
    calls.push(q);
    return q.language ? page([]) : page([movie(10, { language: 'en', rating: 6 })], { totalResults: 120 });
  });
  assert.equal(outcome.mode, 'fallback');
  assert.equal(outcome.totalMatches, 120);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].language, undefined);
  assert.equal(calls[1].minRating, undefined);
});

test('results that do not truly satisfy the filters are never reported as exact matches', async () => {
  const outcome = await runRecommendation(criteria, async (q) =>
    q.language ? page([movie(1, { language: 'en' })]) : page([movie(2, { language: 'en' })])
  );
  assert.equal(outcome.mode, 'fallback');
  assert.deepEqual(
    outcome.movies.map((m) => m.id),
    [2]
  );
});

test('nothing at all for the genre -> "none"', async () => {
  const outcome = await runRecommendation(criteria, async () => page([]));
  assert.equal(outcome.mode, 'none');
  assert.equal(outcome.movies.length, 0);
  assert.equal(canLoadMore(outcome), false);
});

test('loadMoreRecommendations appends the next page without duplicates', async () => {
  const first = await runRecommendation(criteria, async () => page([movie(1), movie(2)], { totalPages: 2, totalResults: 4 }));
  assert.equal(canLoadMore(first), true);
  const next = await loadMoreRecommendations(first, criteria, async (q) => {
    assert.equal(q.page, 2);
    return page([movie(2), movie(3)], { page: 2, totalPages: 2, totalResults: 4 });
  });
  assert.deepEqual(
    next.movies.map((m) => m.id),
    [1, 2, 3]
  );
  assert.equal(canLoadMore(next), false);
});

test('describeMismatches names every filter a fallback movie misses', () => {
  assert.deepEqual(describeMismatches(movie(1), criteria), []);
  const reasons = describeMismatches(movie(2, { language: 'en', languageName: 'English', rating: 6.1 }), criteria, {
    languageName: 'Hindi',
  });
  assert.deepEqual(reasons, ['Language: English (you chose Hindi)', 'Rating 6.1 is below 7.0']);
  assert.deepEqual(describeMismatches(movie(3, { rating: null }), criteria), ['No TMDB rating yet']);
  assert.deepEqual(describeMismatches(movie(4, { genreIds: [35] }), criteria), ['Different genre']);
});

test('describeCriteria is readable', () => {
  assert.equal(
    describeCriteria(criteria, { genreName: 'Action', languageName: 'Hindi' }),
    'Genre: Action · Language: Hindi · Min rating: 7.0+'
  );
  assert.equal(
    describeCriteria({ genreId: 28, language: '', minRating: 0 }, { genreName: 'Action' }),
    'Genre: Action · Language: Any · Min rating: Any'
  );
});
