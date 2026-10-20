/**
 * The one rule that makes the personal data promise real. Pure, no
 * state, no clock and no database, so it is trivially testable, and it
 * runs at every place text leaves or is stored.
 */

/** What a scrubbed value is replaced with. */
export const SCRUBBED_PLACEHOLDER = "[redacted]";

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const LONG_DIGIT_RUN_PATTERN = /\d{8,}/g;

/**
 * Removes email addresses and runs of eight or more digits from a
 * string, replacing each with the placeholder. Names, display names and
 * phone numbers stay inside because the surrounding context is never
 * attached in the first place; this is the second line of defence.
 * Takes the raw text, returns the scrubbed text.
 */
export function scrubText(value: string): string {
  return value.replace(EMAIL_PATTERN, SCRUBBED_PLACEHOLDER).replace(LONG_DIGIT_RUN_PATTERN, SCRUBBED_PLACEHOLDER);
}