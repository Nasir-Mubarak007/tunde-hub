import { ROUTE_PARAM_SEGMENT, ROUTE_UNKNOWN } from "../domain/constants";

/**
 * The one owned rule that turns whatever the monitor hands us into a route
 * template. A slug, an id or a query string never reaches either destination,
 * because both the server and the browser name a route through this function.
 */

/** Words the app itself uses in a path. Anything else in a segment position is a value, not a route. */
const STATIC_SEGMENTS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "auth",
  "cron",
  "edit",
  "health",
  "listings",
  "monitoring",
  "new",
  "uploadthing",
]);

/** The framework's own file suffix on a route template, which is not part of the url. */
const ROUTE_FILE_SUFFIXES: ReadonlySet<string> = new Set(["page", "route"]);

/** Request methods a monitor names a server span with, dropped before normalisation. */
const HTTP_METHODS: ReadonlySet<string> = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

/** Tells a route segment that is already a template placeholder. Takes the segment, returns the answer. */
function isTemplateSegment(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

/** Takes the raw text, returns the path portion with no query string and no origin. */
function pathPart(value: string): string {
  const withoutQuery = value.split(/[?#]/)[0];
  const withoutOrigin = withoutQuery.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*/, "");
  return withoutOrigin;
}

/**
 * Normalises any route spelling into a template. Takes a route template, a
 * pathname, or a monitor span name, returns the bracket form route with no
 * value in it, or the unknown constant when nothing usable is left.
 */
export function normaliseRouteName(value: string | undefined): string {
  if (value === undefined) {
    return ROUTE_UNKNOWN;
  }
  const segments = pathPart(value)
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");
  while (segments.length > 0 && HTTP_METHODS.has(segments[0] as string)) {
    segments.shift();
  }
  while (segments.length > 1 && ROUTE_FILE_SUFFIXES.has(segments[segments.length - 1] as string)) {
    segments.pop();
  }
  const normalised = segments.map((segment) =>
    isTemplateSegment(segment) || STATIC_SEGMENTS.has(segment) ? segment : ROUTE_PARAM_SEGMENT,
  );
  return normalised.length === 0 ? ROUTE_UNKNOWN : `/${normalised.join("/")}`;
}

/**
 * Names the route for an event, preferring the transaction the monitor
 * already assigned and falling back to the request path. Takes the candidate
 * names in order, returns the first usable template.
 */
export function routeNameFrom(...candidates: readonly (string | undefined)[]): string {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate.trim() === "") {
      continue;
    }
    const normalised = normaliseRouteName(candidate);
    if (normalised !== ROUTE_UNKNOWN) {
      return normalised;
    }
  }
  return ROUTE_UNKNOWN;
}