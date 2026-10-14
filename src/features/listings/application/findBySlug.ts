/**
 * The listing detail use case.
 * Thin orchestrator: loads by slug, applies the visibility gate, then hands
 * back either the full detail for a signed in buyer or the public preview
 * for an anonymous visitor. Unknown, pending and soft deleted slugs read as
 * not found to everyone but the owner.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import { canViewListingDetail, isPublicCardVisible } from "../domain/visibility";
import type { ListingRepository, ListingImageStore } from "../domain/repositories";
import { toDetailDto, toPreviewDto } from "./listingDto";
import type { ListingDetailDto, ListingPreviewDto } from "./listingDto";
import type { Viewer } from "./viewer";

/** What the detail page renders: the full facts, or the public preview. */
export type ListingDetailResult = ListingDetailDto | ListingPreviewDto;

/** Deps. Takes the listing plus image ports. */
export interface FindBySlugDeps {
  readonly listings: ListingRepository;
  readonly images: ListingImageStore;
}

/** Input. Takes the slug plus the viewer facts. */
export interface FindBySlugInput {
  readonly slug: string;
  readonly viewer: Viewer;
}

/**
 * Finds a listing by slug. Takes deps plus input plus the clock, returns
 * detail, preview, or not found.
 * A buyer holding a pending claim may open that one listing to get their
 * chat link back. Cards and every other visitor still never see it.
 */
export async function findListingBySlug(
  deps: FindBySlugDeps,
  input: FindBySlugInput,
  now: Date,
): Promise<Result<ListingDetailResult, "not-found">> {
  const slug = input.slug.trim();
  if (slug.length === 0) {
    return err("not-found");
  }
  const listing = await deps.listings.findBySlug(slug);
  if (listing === null) {
    return err("not-found");
  }
  if (input.viewer !== null && input.viewer.role === "owner") {
    const images = await deps.images.listForListing(listing.id);
    return ok(toDetailDto(listing, images));
  }
  const holdsThisListing =
    input.viewer !== null && input.viewer.role === "customer" && listing.claimedByUserId === input.viewer.userId;
  if (holdsThisListing && listing.status === "pending" && listing.deletedAt === null) {
    const images = await deps.images.listForListing(listing.id);
    return ok(toDetailDto(listing, images));
  }
  const role = input.viewer === null ? "anonymous" : "customer";
  if (!isPublicCardVisible(listing, now)) {
    return err("not-found");
  }
  if (role === "anonymous") {
    return ok(toPreviewDto(listing));
  }
  if (!canViewListingDetail(role, listing, now)) {
    return err("not-found");
  }
  const images = await deps.images.listForListing(listing.id);
  return ok(toDetailDto(listing, images));
}
