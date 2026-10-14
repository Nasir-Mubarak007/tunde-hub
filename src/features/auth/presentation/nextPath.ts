/**
 * The post auth landing path.
 * Only a same origin path is ever honored, so a crafted next value can never
 * bounce a fresh session to another site. Anything else lands home.
 */

/** Resolves the landing path. Takes the raw next value, returns a safe path or home. */
export function resolveNextPath(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value.length === 0) {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/";
  }
  return value;
}
