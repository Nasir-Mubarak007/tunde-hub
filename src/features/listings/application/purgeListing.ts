/**
 * The purge listing use case.
 * A real removal, so the rows go for good: the listing row first would
 * cascade the screenshot rows away before their file keys could be read,
 * so the order is keys, then image rows, then the listing row. The stored
 * files go last and best effort, because a provider refusal must not
 * leave the database holding a listing nobody can ever purge again.
 * The refusal is returned, never thrown, and logged by the caller.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import { canManageListings } from "../domain/visibility";
import type { ViewerRole } from "../domain/visibility";
import type { FileStore, ListingImageStore, ListingRepository } from "../domain/repositories";

/** Deps. Takes the ports the use case calls, returned as is. */
export interface PurgeListingDeps {
  readonly listings: ListingRepository;
  readonly images: ListingImageStore;
  readonly files: FileStore;
}

/** Input. Takes the actor role plus the listing id. */
export interface PurgeListingInput {
  readonly actorRole: ViewerRole;
  readonly listingId: number;
}

/** What a successful purge returns: the id that went, and any files left behind. */
export interface PurgeListingSuccess {
  readonly listingId: number;
  /** File keys the provider would not delete. Empty when every file went. */
  readonly orphanedFileKeys: readonly string[];
}

/** Why a purge is refused. Only the owner role and a missing row. */
export type PurgeListingError = "not-owner" | "listing-not-found";

/** Removes one listing for good. Takes deps plus input, returns the id or the reason. */
export async function purgeListingForOwner(
  deps: PurgeListingDeps,
  input: PurgeListingInput,
): Promise<Result<PurgeListingSuccess, PurgeListingError>> {
  if (!canManageListings(input.actorRole)) {
    return err("not-owner");
  }
  const listing = await deps.listings.findById(input.listingId);
  if (listing === null) {
    return err("listing-not-found");
  }

  const images = await deps.images.listForListing(listing.id);
  const fileKeys = images.flatMap((image) => (image.fileKey === null ? [] : [image.fileKey]));

  await deps.images.removeForListing(listing.id);
  await deps.listings.removeById(listing.id);

  if (fileKeys.length === 0) {
    return ok({ listingId: listing.id, orphanedFileKeys: [] });
  }
  try {
    await deps.files.deleteFiles(fileKeys);
  } catch {
    return ok({ listingId: listing.id, orphanedFileKeys: fileKeys });
  }
  return ok({ listingId: listing.id, orphanedFileKeys: [] });
}