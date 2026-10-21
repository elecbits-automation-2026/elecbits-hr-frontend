/**
 * Fixed operating rules — the backend enforces the same numbers
 * (shared/constants: CITATION_*, REGULARIZE_WINDOW_DAYS). They used to be org
 * settings; they are deliberately not tunable.
 */
/** Shortest / longest R&R nomination citation, in characters. */
export const CITATION_MIN_LENGTH = 50;
export const CITATION_MAX_LENGTH = 500;
/** Days back a punch may be regularized or a late work update entered. */
export const REGULARIZE_WINDOW_DAYS = 14;
