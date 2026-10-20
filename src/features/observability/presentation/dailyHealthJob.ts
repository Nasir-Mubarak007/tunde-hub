import type { PrunedRowCounts } from "../domain/repositories";
import { env } from "@/core/env";
import { isAuthorizedCronRequest } from "../infrastructure/cronAuth";
import { runDailyMonitorStep } from "../infrastructure/container";

/**
 * The daily health step behind the scheduled route. It holds no framework
 * code: the route owns the request and the status codes, this owns the
 * decision about who may run it and what running it means.
 */

/** What one request to the daily route may end as. */
export type DailyHealthOutcome =
  | { readonly authorized: false }
  | { readonly authorized: true; readonly pinged: boolean; readonly pruned: PrunedRowCounts };

/**
 * Runs the daily step for the caller. Takes the authorization header,
 * returns the refusal or the report. Throws when the prune fails, so the
 * scheduled job shows a failure instead of a cheerful empty body.
 */
export async function runDailyHealthJob(authorizationHeader: string | null): Promise<DailyHealthOutcome> {
  if (!isAuthorizedCronRequest(authorizationHeader, env().CRON_SECRET)) {
    return { authorized: false };
  }
  const report = await runDailyMonitorStep();
  return { authorized: true, pinged: report.pinged, pruned: report.pruned };
}