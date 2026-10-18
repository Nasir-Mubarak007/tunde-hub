import type { DataCollection, ErrorEvent, EventHint, StackFrame, Stacktrace } from "@sentry/core";
import { scrubText } from "../application/scrub";
import { UNKNOWN_FAILURE_MESSAGE } from "../domain/constants";
import { routeNameFrom } from "./routeName";

/**
 * The capture adapters shared by every runtime. Nothing here touches the
 * database and nothing here imports the SDK at runtime, so the browser and
 * the edge runtime can use exactly the same scrub as the server.
 */

/**
 * The collection switches that make AC-3 true: no request body, cookie,
 * header, query string, user field, database parameter or local variable
 * ever reaches the monitor. They are switched off rather than left to a
 * default, so a future SDK default cannot quietly open the door.
 */
export const NO_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
};

/** The attribute the SDK writes its span operation to. */
export const SENTRY_OP_ATTRIBUTE = "sentry.op";

/** The operation value every request level server span carries. */
export const HTTP_SERVER_OP = "http.server";

/** The attributes a request level span may name its method on. */
const METHOD_ATTRIBUTES = ["http.request.method", "http.method"] as const;

/** The attributes a request level span may name its path on. */
const PATH_ATTRIBUTES = ["http.route", "url.path"] as const;

/** Reads one span attribute as text. Takes the attributes plus the key, returns the text or undefined. */
export function spanText(attributes: Record<string, unknown>, key: string): string | undefined {
  const value = attributes[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Reads the first attribute that carries text. Takes the attributes plus the keys, returns the text or undefined. */
function firstSpanText(attributes: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = spanText(attributes, key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/**
 * Names the route an event belongs to. Takes the event, returns the bracket
 * form route, never a url and never a value out of a dynamic segment.
 */
export function routeForEvent(event: ErrorEvent): string {
  return routeNameFrom(event.transaction, event.request?.url);
}

/**
 * Scrubs an event in place and strips everything that must never leave the
 * app. Takes the event plus the route name it will be filed under, returns
 * nothing. The same scrubbed text is what the monitor receives and what the
 * local row stores, so the database is not a leak path the monitor is not.
 */
export function scrubFailureEvent(event: ErrorEvent, route: string): void {
  if (event.message !== undefined) {
    event.message = scrubText(event.message);
  }
  if (event.logentry?.message !== undefined) {
    event.logentry.message = scrubText(event.logentry.message);
  }
  for (const value of event.exception?.values ?? []) {
    if (value.value !== undefined) {
      value.value = scrubText(value.value);
    }
    for (const frame of value.stacktrace?.frames ?? []) {
      if (frame.filename !== undefined) {
        frame.filename = scrubText(frame.filename);
      }
    }
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message !== undefined) {
      breadcrumb.message = scrubText(breadcrumb.message);
    }
  }
  if (event.request !== undefined) {
    event.request.url = route;
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    delete event.request.env;
  }
  delete event.user;
}

/** Renders a stack trace back into text. Takes the stack trace, returns the lines, or null when there are none. */
function stacktraceText(stacktrace: Stacktrace): string | null {
  const lines = (stacktrace.frames ?? []).map((frame: StackFrame) => {
    const where = `${frame.filename ?? "unknown"}:${frame.lineno ?? 0}:${frame.colno ?? 0}`;
    return `    at ${frame.function ?? "<anonymous>"} (${where})`;
  });
  return lines.length === 0 ? null : lines.join("\n");
}

/** Reads the message a capture carries. Takes the event, returns the message, never an empty string. */
export function messageForEvent(event: ErrorEvent): string {
  const values = event.exception?.values ?? [];
  const last = values.length > 0 ? values[values.length - 1] : undefined;
  if (last?.value !== undefined && last.value !== "") {
    return last.value;
  }
  if (event.message !== undefined && event.message !== "") {
    return event.message;
  }
  if (event.logentry?.message !== undefined && event.logentry.message !== "") {
    return event.logentry.message;
  }
  return UNKNOWN_FAILURE_MESSAGE;
}

/**
 * Reads the message and the stack a capture carries, preferring the original
 * thrown error because that is the real stack, before any scrubbing.
 * Takes the event plus the hint, returns the message plus the stack or null.
 */
export function messageAndStackFor(event: ErrorEvent, hint: EventHint): { readonly message: string; readonly stack: string | null } {
  const original = hint.originalException;
  const message = original instanceof Error ? original.message : messageForEvent(event);
  const stack =
    original instanceof Error && typeof original.stack === "string"
      ? original.stack
      : (() => {
          const values = event.exception?.values ?? [];
          const last = values.length > 0 ? values[values.length - 1] : undefined;
          return last?.stacktrace !== undefined ? stacktraceText(last.stacktrace) : null;
        })();
  return { message: scrubText(message), stack: stack !== null ? scrubText(stack) : null };
}

/**
 * The before send hook for the runtimes that write no local row: the
 * browser and the edge. Scrubbing still happens there, so nothing reaches
 * the monitor unscrubbed. Takes the event plus the hint, returns the event.
 */
export function beforeSendScrubbed(event: ErrorEvent): ErrorEvent | null {
  try {
    scrubFailureEvent(event, routeForEvent(event));
  } catch {
    // The monitor can never change a response, and it can never fail a send.
  }
  return event;
}

/** Reads the request method a span names, or null when it names none. Takes the attributes, returns the method or null. */
export function spanMethodFor(attributes: Record<string, unknown>): string | null {
  return firstSpanText(attributes, METHOD_ATTRIBUTES) ?? null;
}

/** Reads the path a span names, or null when it names none. Takes the attributes, returns the path or null. */
export function spanPathFor(attributes: Record<string, unknown>): string | null {
  return firstSpanText(attributes, PATH_ATTRIBUTES) ?? null;
}