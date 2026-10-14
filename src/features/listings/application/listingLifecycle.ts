/**
 * The soft delete and restore use cases.
 * Both are owner only, both are single writes, and neither touches the
 * screenshot rows: a restore must bring the listing back exactly as it
 * was, so the files stay put until a real purge removes them.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import { restoreListing, softDeleteListing } from "../domain/listing";
import type { Listing } from "../domain/listing";
import { canManageListings } from "../domain/visibility";
import type { ViewerRole } from "../domain/visibility";
import type { ListingRepository } from "../domain/repositories";

/** Deps. Takes the listing port, returned as is. */
export interface ListingWriteDeps {
  readonly listings: ListingRepository;
}

/** Input for either move. Takes the actor role plus the listing id. */
export interface ListingLifecycleInput {
  readonly actorRole: ViewerRole;
  readonly listingId: number;
}

/** Why either move is refused. The owner role and a missing row are the only reasons. */
export type ListingLifecycleError = "not-owner" | "listing-not-found";

/** Soft deletes one listing. Takes deps plus input plus the clock, returns the row or the reason. Idempotent. */
export async function softDeleteListingForOwner(
  deps: ListingWriteDeps,
  input: ListingLifecycleInput,
  now: Date,
): Promise<Result<Listing, ListingLifecycleError>> {
  if (!canManageListings(input.actorRole)) {
    return err("not-owner");
  }
  const listing = await deps.listings.findById(input.listingId);
  if (listing === null) {
    return err("listing-not-found");
  }
  return ok(await deps.listings.saveListing(softDeleteListing(listing, now)));
}

/** Restores one soft deleted listing. Takes deps plus input plus the clock, returns the row or the reason. */
export async function restoreListingForOwner(
  deps: ListingWriteDeps,
  input: ListingLifecycleInput,
  now: Date,
): Promise<Result<Listing, ListingLifecycleError>> {
  if (!canManageListings(input.actorRole)) {
    return err("not-owner");
  }
  const listing = await deps.listings.findById(input.listingId);
  if (listing === null) {
    return err("listing-not-found");
  }
  return ok(await deps.listings.saveListing(restoreListing(listing, now)));
}