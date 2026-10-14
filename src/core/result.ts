/**
 * Shared outcome helpers for pure layers.
 * Domain failures are values shaped as Result, never thrown objects.
 * Only truly unexpected failures throw, and those reach Sentry.
 */

/** A domain outcome. Takes a value type and an error type, returns the union. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Wraps a success value. Takes the value, returns an ok Result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Wraps a failure. Takes the error, returns an err Result. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Narrows an exhaustive switch. Takes a value typed never, always throws. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
