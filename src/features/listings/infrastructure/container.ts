/**
 * The listings composition root.
 * The one place infrastructure meets the use cases, so presentation imports
 * ready to call functions and never a driver or a table.
 */
import { randomBytes } from "node:crypto";
import { claimListing } from "../application/claimListing";
import type { ClaimListingDeps, ClaimListingInput, ClaimListingResult } from "../application/claimListing";
import { createListingForOwner } from "../application/createListing";
import type { CreateListingError, CreateListingInput } from "../application/createListing";
import { updateListingForOwner } from "../application/updateListing";
import type { UpdateListingError, UpdateListingInput } from "../application/updateListing";
import {
  restoreListingForOwner,
  softDeleteListingForOwner,
} from "../application/listingLifecycle";
import type { ListingLifecycleError, ListingLifecycleInput } from "../application/listingLifecycle";
import { purgeListingForOwner } from "../application/purgeListing";
import type { PurgeListingError, PurgeListingInput, PurgeListingSuccess } from "../application/purgeListing";
import {
  bulkConfirmSoldForOwner,
  bulkReleaseForOwner,
  confirmSoldForOwner,
  markSoldDirectForOwner,
  releaseListingForOwner,
  reopenSoldForOwner,
} from "../application/saleLifecycle";
import type {
  BulkSaleError,
  BulkSaleInput,
  BulkSaleOutput,
  SaleLifecycleDeps,
  SaleMoveError,
  SaleMoveInput,
} from "../application/saleLifecycle";
import { listListingsForAdmin } from "../application/listForAdmin";
import type { ListForAdminError, ListForAdminInput, ListForAdminOutput } from "../application/listForAdmin";
import { getAdminOverview } from "../application/adminOverview";
import type { AdminOverviewError } from "../application/adminOverview";
import { findListingBySlug } from "../application/findBySlug";
import type { FindBySlugDeps, FindBySlugInput, ListingDetailResult } from "../application/findBySlug";
import { listAvailable } from "../application/listAvailable";
import type { ListAvailableInput, ListAvailableOutput } from "../application/listAvailable";
import type { Result } from "@/core/result";
import type { AdminCounts } from "../domain/repositories";
import type { Listing } from "../domain/listing";
import type { ViewerRole } from "../domain/visibility";

import { claimStore, rateLimitStore } from "./drizzle/claimStore";
import { listingImageStore } from "./drizzle/listingImageStore";
import { listingSaleStore } from "./drizzle/saleStore";
import { adminListingQuery, listingQuery, listingRepository } from "./drizzle/listingRepository";
import { appTransitionLog } from "./appTransitionLog";
import { fileStore } from "./uploadthingFileStore";
import { canManageListings } from "../domain/visibility";
import type { ListingImage } from "../domain/listingImage";

/** How many cursor pages one render may walk before it stops. Guards a repeated cursor. */
const MAX_CURSOR_PAGES = 20;

/** Claim deps. Takes the ports the use case calls, returns them wired. */
function claimDeps(): ClaimListingDeps {
  return {
    listings: listingRepository,
    query: listingQuery,
    claims: claimStore,
    rateLimit: rateLimitStore,
    newClaimToken: () => randomBytes(32).toString("hex"),
  };
}

/** Detail deps. Takes the ports the use case calls, returns them wired. */
function findDeps(): FindBySlugDeps {
  return { listings: listingRepository, images: listingImageStore };
}

/** Sale deps. Takes the read port, the conditional write port and the log sink, returns them wired. */
function saleDeps(): SaleLifecycleDeps {
  return { listings: listingRepository, sales: listingSaleStore, transitions: appTransitionLog };
}

/** Lists the cards for the grid. Takes input plus the clock, returns the page or the reason. */
export async function listStorefrontCards(
  input: ListAvailableInput,
  now: Date,
): Promise<Result<ListAvailableOutput, string>> {
  return listAvailable({ listings: listingQuery }, input, now);
}

/** Reads detail behind the gate. Takes input plus the clock, returns full detail, preview, or not found. */
export async function getListingDetail(
  input: FindBySlugInput,
  now: Date,
): Promise<Result<ListingDetailResult, "not-found">> {
  return findListingBySlug(findDeps(), input, now);
}

/**
 * Renders every page from the top through the requested cursor.
 * Takes the filters plus the cursor plus the clock, returns the whole visible
 * list plus the cursor for the page after it, so Load more keeps working.
 */
export async function listCardsThroughCursor(
  input: ListAvailableInput,
  requestedCursor: string,
  now: Date,
): Promise<{ readonly items: readonly ListAvailableOutput["items"][number][]; readonly nextCursor: string | null }> {
  const items: ListAvailableOutput["items"][number][] = [];
  const withoutCursor = { ...input, cursor: undefined };
  let cursor: string | undefined;
  let nextCursor: string | null = null;
  for (let page = 0; page < MAX_CURSOR_PAGES; page += 1) {
    const result = await listStorefrontCards({ ...withoutCursor, cursor }, now);
    if (!result.ok) {
      break;
    }
    items.push(...result.value.items);
    if (result.value.nextCursor === null || cursor === requestedCursor) {
      nextCursor = result.value.nextCursor;
      break;
    }
    cursor = result.value.nextCursor;
  }
  return { items, nextCursor };
}

/** Claims one listing for one buyer. Takes the input plus the clock, returns the outcome as a value. */
export async function claimListingForBuyer(
  input: ClaimListingInput,
  now: Date,
): Promise<ClaimListingResult> {
  return claimListing(claimDeps(), input, now);
}

/** Creates one listing for the owner. Takes the input plus the clock, returns the row or the reason. */
export async function createListingForOwnerAction(
  input: CreateListingInput,
  now: Date,
): Promise<Result<Listing, CreateListingError>> {
  return createListingForOwner({ listings: listingRepository, images: listingImageStore }, input, now);
}

/** Updates one listing for the owner. Takes the input plus the clock, returns the row or the reason. */
export async function updateListingForOwnerAction(
  input: UpdateListingInput,
  now: Date,
): Promise<Result<Listing, UpdateListingError>> {
  return updateListingForOwner({ listings: listingRepository, images: listingImageStore }, input, now);
}

/** Soft deletes one listing. Takes the input plus the clock, returns the row or the reason. */
export async function softDeleteListingForOwnerAction(
  input: ListingLifecycleInput,
  now: Date,
): Promise<Result<Listing, ListingLifecycleError>> {
  return softDeleteListingForOwner({ listings: listingRepository }, input, now);
}

/** Restores one soft deleted listing. Takes the input plus the clock, returns the row or the reason. */
export async function restoreListingForOwnerAction(
  input: ListingLifecycleInput,
  now: Date,
): Promise<Result<Listing, ListingLifecycleError>> {
  return restoreListingForOwner({ listings: listingRepository }, input, now);
}

/**
 * Purges one listing for good. Takes the input, returns the id or the reason.
 * Files the provider refused are logged here, so an orphan is traceable in
 * the logs rather than silent, then returned to the caller.
 */
export async function purgeListingForOwnerAction(
  input: PurgeListingInput,
): Promise<Result<PurgeListingSuccess, PurgeListingError>> {
  const result = await purgeListingForOwner(
    { listings: listingRepository, images: listingImageStore, files: fileStore },
    input,
  );
  if (result.ok && result.value.orphanedFileKeys.length > 0) {
    console.error("Purge left orphaned files behind.", {
      listingId: result.value.listingId,
      fileKeys: result.value.orphanedFileKeys,
    });
  }
  return result;
}

/** Lists one page of listings for the panel. Takes the input, returns the page or the reason. */
export async function listListingsForAdminAction(
  input: ListForAdminInput & { readonly actorRole: ViewerRole },
): Promise<Result<ListForAdminOutput, ListForAdminError>> {
  return listListingsForAdmin({ listings: adminListingQuery }, input);
}

/** Reads the overview counts for the panel. Takes the actor role, returns the counts or the reason. */
export async function getAdminOverviewAction(
  actorRole: ViewerRole,
): Promise<Result<AdminCounts, AdminOverviewError>> {
  return getAdminOverview({ listings: adminListingQuery }, { actorRole });
}

/** One listing plus its screenshots for the edit form. Plain values the panel can print. */
export interface ListingEditPayload {
  readonly listing: Listing;
  readonly images: readonly ListingImage[];
}

/** Reads one listing for the edit form. Takes the id plus the actor role, returns the row plus images or the reason. */
export async function getListingForOwnerEdit(
  listingId: number,
  actorRole: ViewerRole,
): Promise<Result<ListingEditPayload, "not-owner" | "listing-not-found">> {
  if (!canManageListings(actorRole)) {
    return { ok: false, error: "not-owner" };
  }
  const listing = await listingRepository.findById(listingId);
  if (listing === null) {
    return { ok: false, error: "listing-not-found" };
  }
  const images = await listingImageStore.listForListing(listing.id);
  return { ok: true, value: { listing, images } };
}

/** Confirms a pending listing as sold. Takes the input plus the clock, returns the moved row or the reason. */
export async function confirmSoldForOwnerAction(
  input: SaleMoveInput,
  now: Date,
): Promise<Result<Listing, SaleMoveError>> {
  return confirmSoldForOwner(saleDeps(), input, now);
}

/** Sells an available listing straight to sold. Takes the input plus the clock, returns the moved row or the reason. */
export async function markSoldDirectForOwnerAction(
  input: SaleMoveInput,
  now: Date,
): Promise<Result<Listing, SaleMoveError>> {
  return markSoldDirectForOwner(saleDeps(), input, now);
}

/** Releases a pending listing back to available. Takes the input plus the clock, returns the moved row or the reason. */
export async function releaseListingForOwnerAction(
  input: SaleMoveInput,
  now: Date,
): Promise<Result<Listing, SaleMoveError>> {
  return releaseListingForOwner(saleDeps(), input, now);
}

/** Reopens a sold listing back to available. Takes the input plus the clock, returns the moved row or the reason. */
export async function reopenSoldForOwnerAction(
  input: SaleMoveInput,
  now: Date,
): Promise<Result<Listing, SaleMoveError>> {
  return reopenSoldForOwner(saleDeps(), input, now);
}

/** Confirms many pending listings as sold. Takes the input plus the clock, returns a result per row or the reason. */
export async function bulkConfirmSoldForOwnerAction(
  input: BulkSaleInput,
  now: Date,
): Promise<Result<BulkSaleOutput, BulkSaleError>> {
  return bulkConfirmSoldForOwner(saleDeps(), input, now);
}

/** Releases many pending listings back to available. Takes the input plus the clock, returns a result per row or the reason. */
export async function bulkReleaseForOwnerAction(
  input: BulkSaleInput,
  now: Date,
): Promise<Result<BulkSaleOutput, BulkSaleError>> {
  return bulkReleaseForOwner(saleDeps(), input, now);
}


