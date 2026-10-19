/**
 * Ports the observability use cases and the capture hooks depend on.
 * Infrastructure implements these interfaces. Dependency inversion:
 * the domain declares the shape, the adapter fulfils it.
 * Storage failures are values on the two record methods, so a failing
 * insert can never reach a response. The prune is the one method that
 * throws, because a scheduled job has to see its own failure.
 */
import type { Result } from "./result";
import type { TransitionLogEntry } from "@/features/listings/domain/repositories";

/** Which side of the app captured the event. */
export type CaptureSide = "server" | "browser";

/** What kind of capture produced the event, named by the hook that produced it. */
export type FailureKind = "unhandled" | "captured" | "client-reported";

/** One unexpected failure, already scrubbed, ready to store. */
export interface FailureRecord {
  readonly kind: FailureKind;
  readonly message: string;
  readonly stack: string | null;
  readonly route: string;
  readonly side: CaptureSide;
  readonly sentryEventId: string | null;
}

/** One slow request, already measured by the monitor, ready to store. */
export interface SlowRequestRecord {
  readonly method: string | null;
  readonly route: string;
  readonly durationMs: number;
  readonly side: CaptureSide;
  readonly sentryEventId: string | null;
}

/** How many rows the retention prune removed from each table. */
export interface PrunedRowCounts {
  readonly errorEvents: number;
  readonly slowRequests: number;
}

/**
 * The local failure record. Both record methods are append only and
 * ignore their own storage failure by returning it as a value, so a
 * failing insert changes no response and breaks no page. No port
 * signature carries a timestamp: the database clock stamps every row.
 */
export interface FailureRecorder {
  /** Stores one failure. Takes the record, returns ok or the storage refusal. */
  recordFailure(record: FailureRecord): Promise<Result<void, "observability-storage-failed">>;
  /** Stores one slow request. Takes the record, returns ok or the storage refusal. */
  recordSlowRequest(record: SlowRequestRecord): Promise<Result<void, "observability-storage-failed">>;
  /** Deletes rows older than the retention window. Takes nothing, returns the removed counts. Throws when storage fails. */
  pruneOlderThan(): Promise<PrunedRowCounts>;
}

/**
 * Where lifecycle moves are mirrored as capture context. Breadcrumbs
 * cost nothing on their own, so the implementation is allowed to be a
 * no op when reporting is off. Like every log sink here it never throws.
 */
export interface BreadcrumbSink {
  /** Records one move. Takes the existing transition entry, returns nothing. Never throws. */
  recordTransition(entry: TransitionLogEntry): void;
}