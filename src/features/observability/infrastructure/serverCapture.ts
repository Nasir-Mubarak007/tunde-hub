import * as Sentry from "@sentry/nextjs";
import type { ErrorEvent, EventHint, StreamedSpanJSON } from "@sentry/core";
import type { TransitionLogEntry } from "@/features/listings/domain/repositories";
import { MONITOR_APP_NAME, SLOW_REQUEST_MS } from "../domain/constants";
import type { BreadcrumbSink } from "../domain/repositories";
import {
  HTTP_SERVER_OP,
  SENTRY_OP_ATTRIBUTE,
  messageAndStackFor,
  routeForEvent,
  scrubFailureEvent,
  spanMethodFor,
  spanPathFor,
  spanText,
} from "./captureAdapters";
import { failureRecorder } from "./drizzle/failureStore";
import { routeNameFrom } from "./routeName";

/**
 * The Node.js capture adapter. It is the only runtime that owns the local
 * row, because it is the only one that can reach the database. Everything
 * here is wrapped: the monitor can never change a response, break a page or
 * turn a refused insert into a thrown failure.
 */

/**
 * The before send hook for an error event. The local row is written from
 * this stage and not from an after send callback, so an event the monitor
 * refuses still leaves a record behind. Takes the event plus the hint,
 * returns the event after its row is stored.
 */
export async function beforeSendWithLocalRow(event: ErrorEvent, hint: EventHint): Promise<ErrorEvent | null> {
  try {
    const route = routeForEvent(event);
    scrubFailureEvent(event, route);
    const { message, stack } = messageAndStackFor(event, hint);
    const stored = await failureRecorder.recordFailure({
      kind: "unhandled",
      message,
      stack,
      route,
      side: "server",
      sentryEventId: event.event_id ?? null,
    });
    void stored;
  } catch {
    // A storage failure is a value the adapter deliberately ignores, and a
    // failure inside the monitor itself must never reach a response.
  }
  return event;
}

/**
 * The before send hook for a span, which is where a slow request is judged
 * against the owned threshold. The hook is synchronous, so the local row is
 * written without waiting for it and the monitor's own timing is used, never
 * an app clock. Takes the span, returns the span untouched.
 */
export function beforeSendSlowRequestWithLocalRow(span: StreamedSpanJSON): StreamedSpanJSON {
  try {
    const attributes = span.attributes as Record<string, unknown>;
    if (!span.is_segment || span.end_timestamp === undefined) {
      return span;
    }
    if (spanText(attributes, SENTRY_OP_ATTRIBUTE) !== HTTP_SERVER_OP) {
      return span;
    }
    const durationMs = Math.round((span.end_timestamp - span.start_timestamp) * 1000);
    if (!Number.isFinite(durationMs) || durationMs < SLOW_REQUEST_MS) {
      return span;
    }
    void failureRecorder
      .recordSlowRequest({
        method: spanMethodFor(attributes),
        route: routeNameFrom(span.name, spanPathFor(attributes) ?? undefined),
        durationMs,
        side: "server",
        sentryEventId: span.span_id,
      })
      .catch(() => undefined);
  } catch {
    // Same rule as every other capture hook: swallow and carry on.
  }
  return span;
}

/**
 * Records one sale move as capture context. The actor id is deliberately
 * left out, because the monitor never needs to know which person pressed a
 * button. Takes the existing transition entry, returns nothing. Never throws.
 */
const recordTransition = (entry: TransitionLogEntry): void => {
  try {
    Sentry.addBreadcrumb({
      category: "listing.transition",
      level: "info",
      message: `${entry.from} to ${entry.to}`,
      data: { listingId: entry.listingId, from: entry.from, to: entry.to },
    });
  } catch {
    // Breadcrumbs cost nothing, so a failure here is never worth a page.
  }
};

export const saleTransitionBreadcrumbs: BreadcrumbSink = { recordTransition };

/**
 * Pings the monitor from the daily job so an app that boots is known to be
 * alive. Writes no local row. Takes the environment name, returns whether
 * the ping step completed, which is true even where reporting is switched off.
 */
export function pingMonitor(environment: string): boolean {
  try {
    Sentry.captureMessage(`${MONITOR_APP_NAME} daily health check`, {
      level: "info",
      tags: { environment },
    });
    return true;
  } catch {
    return false;
  }
}