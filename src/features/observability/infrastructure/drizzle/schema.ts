import { bigint, index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** What kind of capture produced the event, named by the hook that produced it. */
export const errorKindEnum = pgEnum("error_kind", ["unhandled", "captured", "client-reported"]);

/** Which side of the app captured the event. */
export const captureSideEnum = pgEnum("capture_side", ["server", "browser"]);

/**
 * One unexpected failure, scrubbed and stored locally. Append only, the
 * database clock stamps it, and the monitor's event id lets a row be
 * jumped to from the monitor.
 */
export const errorEvents = pgTable(
  "error_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    kind: errorKindEnum("kind").notNull(),
    message: text("message").notNull(),
    stack: text("stack"),
    route: text("route").notNull(),
    side: captureSideEnum("side").notNull(),
    sentryEventId: text("sentry_event_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("error_events_occurred_at_idx").on(t.occurredAt), index("error_events_route_occurred_at_idx").on(t.route, t.occurredAt)]
);

/**
 * One request the monitor measured slower than the owned threshold.
 * The browser half of a route change has no method, so the column is
 * nullable. Append only, pruned by age.
 */
export const slowRequests = pgTable(
  "slow_requests",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    method: text("method"),
    route: text("route").notNull(),
    durationMs: integer("duration_ms").notNull(),
    side: captureSideEnum("side").notNull(),
    sentryEventId: text("sentry_event_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("slow_requests_occurred_at_idx").on(t.occurredAt),
    index("slow_requests_route_occurred_at_idx").on(t.route, t.occurredAt),
  ]
);