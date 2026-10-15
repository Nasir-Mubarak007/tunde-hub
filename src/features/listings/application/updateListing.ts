/**
 * The update listing use case.
 * The slug is frozen, so it never appears here: a changed title keeps the
 * link the owner already shared. Screenshots, when sent, replace the whole
 * set, which keeps the three widths per position rule easy to hold.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import { updateListingDetails } from "../domain/listing";
import type { Listing, ListingValidationIssue } from "../domain/listing";
import { validateListingImages } from "../domain/listingImage";
import type { ListingImageIssue } from "../domain/listingImage";
import { canManageListings } from "../domain/visibility";
import type { ViewerRole } from "../domain/visibility";
import type { ListingImageRow, ListingImageStore, ListingRepository } from "../domain/repositories";
import type { UpdateListingCommand } from "./listingWriteInput";

/** Deps. Takes the ports the use case calls, returns them wired. */
export interface UpdateListingDeps {
  readonly listings: ListingRepository;
  readonly images: ListingImageStore;
}

/** Input. Takes the actor role, the listing id and the parsed command. */
export interface UpdateListingInput {
  readonly actorRole: ViewerRole;
  readonly listingId: number;
  readonly command: UpdateListingCommand;
}

/** What can go wrong. Every reason is a value the panel can show. */
export type UpdateListingError =
  | "not-owner"
  | "listing-not-found"
  | { readonly issues: readonly ListingValidationIssue[] }
  | { readonly imageIssues: readonly ListingImageIssue[] };

/** Updates one listing for the owner. Takes deps plus input plus the clock, returns the row or the reason. */
export async function updateListingForOwner(
  deps: UpdateListingDeps,
  input: UpdateListingInput,
  now: Date,
): Promise<Result<Listing, UpdateListingError>> {
  if (!canManageListings(input.actorRole)) {
    return err("not-owner");
  }
  const listing = await deps.listings.findById(input.listingId);
  if (listing === null) {
    return err("listing-not-found");
  }

  const images = input.command.images;
  if (images !== undefined) {
    const checked = validateListingImages(
      images.map((image) => ({ position: image.position, width: image.width, url: image.url })),
    );
    if (!checked.ok) {
      return err({ imageIssues: checked.error });
    }
  }

  const updated = updateListingDetails(
    listing,
    {
      title: input.command.title,
      platform: input.command.platform,
      priceAmount: input.command.priceAmount,
      currency: input.command.currency,
      followerCount: input.command.followerCount,
      accountAgeMonths: input.command.accountAgeMonths,
      description: input.command.description,
    },
    now,
  );
  if (!updated.ok) {
    return err({ issues: updated.error });
  }

  const saved = await deps.listings.saveListing(updated.value);
  if (images !== undefined) {
    const rows: ListingImageRow[] = images.map((image) => ({
      position: image.position,
      width: image.width,
      url: image.url,
      fileKey: image.fileKey ?? null,
    }));
    await deps.images.replaceForListing(saved.id, rows);
  }
  return ok(saved);
}