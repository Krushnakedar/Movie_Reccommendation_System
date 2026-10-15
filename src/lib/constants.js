export const RATING_OPTIONS = [
  { value: 0, label: 'Any Rating' },
  { value: 7.0, label: '7.0+ Good' },
  { value: 8.0, label: '8.0+ Great' },
  { value: 8.5, label: '8.5+ Excellent' },
];

export const SORT_CHOICES = [
  { value: 'popularity.desc', label: 'Most popular' },
  { value: 'vote_average.desc', label: 'Highest rated' },
  { value: 'primary_release_date.desc', label: 'Newest' },
];

/** How many titles each homepage row shows (TMDB returns 20 per page). */
export const HOME_ROW_SIZE = 12;
