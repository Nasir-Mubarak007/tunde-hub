/**
 * The observability composition root. Presentation reaches the recorder,
 * the monitor and the retention prune through here, never through a table.
 */
import type { PrunedRowCounts } from "../domain/repositories";
import { failureRecorder } from "./drizzle/failureStore";
import { readMonitorEnv } from "./monitorEnv";
import { pingMonitor } from "./serverCapture";

/** What one run of the daily step did, so the route can report it. */
export interface DailyMonitorReport {
  readonly pinged: boolean;
  readonly pruned: PrunedRowCounts;
}

/**
 * Runs the daily step in the spec's order: ping the monitor first, so a
 * failure in the prune still proves the app booted, then delete rows older
 * than the retention window. Takes nothing, returns what the step did.
 * Throws when the prune fails, because a job has to see its own failure.
 */
export async function runDailyMonitorStep(): Promise<DailyMonitorReport> {
  const pinged = pingMonitor(readMonitorEnv("server").environment);
  const pruned = await failureRecorder.pruneOlderThan();
  return { pinged, pruned };
}

export { failureRecorder };