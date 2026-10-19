/**
 * Owned constants for the observability area.
 * Everything the spec pins a number or a literal to lives here, so no
 * other file repeats the value and no caller invents one.
 */

/** A request slower than this many milliseconds counts as a slow request. */
export const SLOW_REQUEST_MS = 3_000;

/** How many days a stored failure or slow request row survives. */
export const RETENTION_DAYS = 30;

/** The route stored when the capture carries no route template at all. */
export const ROUTE_UNKNOWN = "unknown";

/** The bracket form a dynamic browser route segment is replaced with. */
export const ROUTE_PARAM_SEGMENT = "[param]";

/** The message stored when a capture arrives with no message anywhere in it. */
export const UNKNOWN_FAILURE_MESSAGE = "Unlabelled failure";

/** The name the daily ping files itself under, so a ping is never anonymous. */
export const MONITOR_APP_NAME = "tundehub";