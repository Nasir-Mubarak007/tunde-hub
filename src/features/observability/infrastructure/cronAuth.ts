import { timingSafeEqual } from "node:crypto";

/**
 * The guard on the daily job. Only the bearer secret opens it, it is the
 * only credential accepted, and the comparison is constant time so a wrong
 * secret cannot be guessed one character at a time.
 */

/** Checks the authorization header against the secret. Takes the header plus the secret, returns the answer. */
export function isAuthorizedCronRequest(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (secret === undefined || secret === "" || authorizationHeader === null) {
    return false;
  }
  const presented = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice("Bearer ".length) : "";
  const given = Buffer.from(presented, "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (given.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(given, expected);
}