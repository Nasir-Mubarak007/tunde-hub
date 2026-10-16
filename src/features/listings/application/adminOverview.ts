/**
 * The admin overview use case.
 * Owner only, one grouped read behind the same gate as the admin list, so
 * the panel can print live counts beside every filter without a second
 * round trip per bucket. Counts are plain numbers, never entities.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import { canManageListings } from "../domain/visibility";
import type { ViewerRole } from "../domain/visibility";
import type { AdminCounts, AdminListingQuery } from "../domain/repositories";

/** Deps. Takes the admin read port, returned as is. */
export interface AdminOverviewDeps {
  readonly listings: AdminListingQuery;
}

/** Input. Takes the actor role only. */
export interface AdminOverviewInput {
  readonly actorRole: ViewerRole;
}

/** Why the overview is refused. Only the owner role. */
export type AdminOverviewError = "not-owner";

/** Reads the overview counts. Takes deps plus input, returns the counts or the reason. */
export async function getAdminOverview(
  deps: AdminOverviewDeps,
  input: AdminOverviewInput,
): Promise<Result<AdminCounts, AdminOverviewError>> {
  if (!canManageListings(input.actorRole)) {
    return err("not-owner");
  }
  return ok(await deps.listings.countForAdmin());
}
