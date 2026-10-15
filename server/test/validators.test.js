import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '../src/errors.js';
import {
  parseDiscoverQuery,
  parseGenreIds,
  parseLanguageCode,
  parseMovieId,
  parsePage,
  parseSearchQuery,
  parseSortBy,
  parseTimeWindow,
  parseYear,
} from '../src/validators.js';

const rejects400 = (fn) => assert.throws(fn, (err) => err instanceof HttpError && err.status === 400);

test('parsePage defaults to 1 and enforces 1..500', () => {
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage(''), 1);
  assert.equal(parsePage('7'), 7);
  assert.equal(parsePage('500'), 500);
  for (const bad of ['0', '501', '-1', '1.5', 'abc', '1e3', ['1', '2']]) rejects400(() => parsePage(bad));
});

test('parseMovieId only accepts positive integers', () => {
  assert.equal(parseMovieId('550'), 550);
  for (const bad of ['0', '-5', 'abc', '12abc', '', undefined, '1234567890123']) rejects400(() => parseMovieId(bad));
});

test('parseSearchQuery trims, collapses whitespace, and bounds length', () => {
  assert.equal(parseSearchQuery('  the   matrix '), 'the matrix');
  rejects400(() => parseSearchQuery(''));
  rejects400(() => parseSearchQuery('   '));
  rejects400(() => parseSearchQuery(undefined));
  rejects400(() => parseSearchQuery('x'.repeat(101)));
  rejects400(() => parseSearchQuery(['a', 'b']));
});

test('parseYear validates 4-digit years in range', () => {
  assert.equal(parseYear('year', undefined), undefined);
  assert.equal(parseYear('year', '1999'), 1999);
  for (const bad of ['99', '1800', '2200', 'abcd']) rejects400(() => parseYear('year', bad));
});

test('parseGenreIds parses, dedupes, and rejects junk', () => {
  assert.deepEqual(parseGenreIds(undefined), []);
  assert.deepEqual(parseGenreIds('28,12,28'), [28, 12]);
  rejects400(() => parseGenreIds('28,abc'));
  rejects400(() => parseGenreIds('28;DROP'));
  rejects400(() => parseGenreIds('1,2,3,4,5,6,7,8,9,10,11'));
});

test('parseLanguageCode lowercases and rejects invalid codes', () => {
  assert.equal(parseLanguageCode('HI'), 'hi');
  assert.equal(parseLanguageCode(undefined), undefined);
  rejects400(() => parseLanguageCode('h'));
  rejects400(() => parseLanguageCode('hindi!'));
  rejects400(() => parseLanguageCode('en,hi'));
});

test('parseSortBy only accepts the allow-list', () => {
  assert.equal(parseSortBy(undefined), 'popularity.desc');
  assert.equal(parseSortBy('vote_average.desc'), 'vote_average.desc');
  rejects400(() => parseSortBy('revenue.desc'));
  rejects400(() => parseSortBy('popularity.desc; drop'));
});

test('parseTimeWindow accepts day|week only', () => {
  assert.equal(parseTimeWindow(undefined), 'week');
  assert.equal(parseTimeWindow('DAY'), 'day');
  rejects400(() => parseTimeWindow('month'));
});

test('parseDiscoverQuery combines and cross-checks fields', () => {
  const q = parseDiscoverQuery({ page: '2', genres: '28,12', language: 'hi', minRating: '7.5', yearFrom: '2010', yearTo: '2019' });
  assert.equal(q.page, 2);
  assert.deepEqual(q.genres, [28, 12]);
  assert.equal(q.genreMode, 'or');
  assert.equal(q.language, 'hi');
  assert.equal(q.minRating, 7.5);
  assert.equal(q.sortBy, 'popularity.desc');

  rejects400(() => parseDiscoverQuery({ yearFrom: '2020', yearTo: '2010' }));
  rejects400(() => parseDiscoverQuery({ minRating: '9', maxRating: '5' }));
  rejects400(() => parseDiscoverQuery({ minRating: '11' }));
  rejects400(() => parseDiscoverQuery({ genreMode: 'xor' }));
});
