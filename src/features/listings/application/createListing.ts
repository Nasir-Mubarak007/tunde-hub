/**
 * The create listing use case.
 * Thin orchestrator: the boundary already parsed the form, so this checks
 * the actor, builds the entity, then inserts. The slug comes from the title
 * and, on a collision, from a capped retry loop over suffixed slugs backed
 * by ON CONFLICT DO NOTHING, so two saves of the same title at once still
 * end with two rows.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import { createListing } from "../domain/listing";
import type { Listing, ListingValidationIssue } from "../domain/listing";
import { MAX_SLUG_SUFFIX_ATTEMPTS, slugWithSuffix, slugify } from "../domain/slug";
import { validateListingImages } from "../domain/listingImage";
import type { ListingImageIssue } from "../domain/listingImage";
import { canManageListings } from "../domain/visibility";
import type { ViewerRole } from "../domain/visibility";
import type { ListingImageRow, ListingImageStore, ListingRepository } from "../domain/repositories";
import type { CreateListingCommand } from "./listingWriteInput";

/** Deps. Takes the ports the use case calls, returns them wired. */
export interface CreateListingDeps {
  readonly listings: ListingRepository;
  readonly images: ListingImageStore;
}

/** Input. Takes the actor role plus the parsed command, returns the new listing. */
export interface CreateListingInput {
  readonly actorRole: ViewerRole;
  readonly command: CreateListingCommand;
}

/** What can go wrong. Every reason is a value the panel can show. */
export type CreateListingError =
  | "not-owner"
  | { readonly issues: readonly ListingValidationIssue[] }
  | { readonly imageIssues: readonly ListingImageIssue[] }
  | "slug-space-exhausted";

/** Creates one listing for the owner. Takes deps plus input plus the clock, returns the row or the reason. */
export async function createListingForOwner(
  deps: CreateListingDeps,
  input: CreateListingInput,
  now: Date,
): Promise<Result<Listing, CreateListingError>> {
  if (!canManageListings(input.actorRole)) {
    return err("not-owner");
  }

  const checkedImages = validateListingImages(
    input.command.images.map((image) => ({ position: image.position, width: image.width, url: image.url })),
  );
  if (!checkedImages.ok) {
    return err({ imageIssues: checkedImages.error });
  }

  const baseSlug = slugify(input.command.title);
  for (let attempt = 0; attempt < MAX_SLUG_SUFFIX_ATTEMPTS; attempt += 1) {
    const built = createListing(
      {
        slug: slugWithSuffix(baseSlug, attempt),
        title: input.command.title,
        description: input.command.description ?? null,
        platform: input.command.platform,
        priceAmount: input.command.priceAmount,
        currency: input.command.currency,
        followerCount: input.command.followerCount,
        accountAgeMonths: input.command.accountAgeMonths,
      },
      now,
    );
    if (!built.ok) {
      return err({ issues: built.error });
    }
    const inserted = await deps.listings.insertListing(built.value);
    if (!inserted.ok) {
      continue;
    }
    if (input.command.images.length > 0) {
      const rows: ListingImageRow[] = input.command.images.map((image) => ({
        position: image.position,
        width: image.width,
        url: image.url,
        fileKey: image.fileKey ?? null,
      }));
      await deps.images.replaceForListing(inserted.value.id, rows);
    }
    return ok(inserted.value);
  }
  return err("slug-space-exhausted");
}