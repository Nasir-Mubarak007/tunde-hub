/**
 * Rate limit facts for public writes.
 * Counts live in Postgres keyed by visitor hash per hour bucket.
 * No raw visitor address is ever stored.
 */

/** Max signup plus claim attempts per visitor hash per hour. */
export const RATE_LIMIT_MAX_ATTEMPTS = 5;

/** Days click rows are kept. Older rows are removed by the daily job. */
export const RATE_LIMIT_RETENTION_DAYS = 30;

/** Plain words for the wait state. Takes nothing, returned as is. */
export const RATE_LIMIT_MESSAGE =
  "You have made too many tries this hour. Try again in an hour, or sign in to claim.";

/** Truncates a clock reading to the hour in UTC. Takes a date, returns a new date. */
export function truncateToHour(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()),
  );
}

/** Tells whether a stored count reached the limit. Takes the count, returns the answer. */
export function isRateLimited(count: number): boolean {
  return count >= RATE_LIMIT_MAX_ATTEMPTS;
}
