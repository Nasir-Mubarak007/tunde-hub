import { sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/db";
import { RETENTION_DAYS } from "../../domain/constants";
import { err, ok } from "../../domain/result";
import type { Result } from "../../domain/result";
import type {
  FailureRecord,
  FailureRecorder,
  PrunedRowCounts,
  SlowRequestRecord,
} from "../../domain/repositories";
import { errorEvents, slowRequests } from "./schema";

/**
 * The local failure record over the two observability tables. Append only,
 * the database clock stamps every row, and both record methods hand their
 * own storage failure back as a value so no capture hook can ever throw.
 */

/** Stores one failure row. Takes the record, returns ok or the storage refusal. */
async function recordFailure(record: FailureRecord): Promise<Result<void, "observability-storage-failed">> {
  try {
    await db.insert(errorEvents).values({
      kind: record.kind,
      message: record.message,
      stack: record.stack,
      route: record.route,
      side: record.side,
      sentryEventId: record.sentryEventId,
    });
    return ok(undefined);
  } catch {
    return err("observability-storage-failed");
  }
}

/** Stores one slow request row. Takes the record, returns ok or the storage refusal. */
async function recordSlowRequest(record: SlowRequestRecord): Promise<Result<void, "observability-storage-failed">> {
  try {
    await db.insert(slowRequests).values({
      method: record.method,
      route: record.route,
      durationMs: record.durationMs,
      side: record.side,
      sentryEventId: record.sentryEventId,
    });
    return ok(undefined);
  } catch {
    return err("observability-storage-failed");
  }
}

/**
 * Deletes rows older than the retention window. Takes nothing, returns the
 * removed counts per table. The cutoff is computed inside the statement, so
 * no app clock ever reaches a row. Throws when storage fails, because the
 * daily job has to see its own failure.
 */
async function pruneOlderThan(): Promise<PrunedRowCounts> {
  const cutoff = sql`now() - (${RETENTION_DAYS} * interval '1 day')`;
  const [errorRows, slowRows] = await Promise.all([
    db.delete(errorEvents).where(sql`${errorEvents.occurredAt} < ${cutoff}`).returning({ id: errorEvents.id }),
    db.delete(slowRequests).where(sql`${slowRequests.occurredAt} < ${cutoff}`).returning({ id: slowRequests.id }),
  ]);
  return { errorEvents: errorRows.length, slowRequests: slowRows.length };
}

export const failureRecorder: FailureRecorder = {
  recordFailure,
  recordSlowRequest,
  pruneOlderThan,
};