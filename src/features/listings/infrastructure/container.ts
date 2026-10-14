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
import { listListingsForAdmin } from "../application/listForAdmin";
import type { ListForAdminError, ListForAdminInput, ListForAdminOutput } from "../application/listForAdmin";
import { findListingBySlug } from "../application/findBySlug";
import type { FindBySlugDeps, FindBySlugInput, ListingDetailResult } from "../application/findBySlug";
import { listAvailable } from "../application/listAvailable";
import type { ListAvailableInput, ListAvailableOutput } from "../application/listAvailable";
import type { Result } from "@/core/result";
import type { Listing } from "../domain/listing";
import type { ViewerRole } from "../domain/visibility";

import { claimStore, rateLimitStore } from "./drizzle/claimStore";
import { listingImageStore } from "./drizzle/listingImageStore";
import { adminListingQuery, listingQuery, listingRepository } from "./drizzle/listingRepository";
import { fileStore } from "./uploadthingFileStore";

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
 * Takes the filters plus the cursor plus the clock, returns the whole visible list.
 */
export async function listCardsThroughCursor(
  input: ListAvailableInput,
  requestedCursor: string,
  now: Date,
): Promise<readonly ListAvailableOutput["items"][number][]> {
  const items: ListAvailableOutput["items"][number][] = [];
  const withoutCursor = { ...input, cursor: undefined };
  let cursor: string | undefined;
  for (let page = 0; page < MAX_CURSOR_PAGES; page += 1) {
    const result = await listStorefrontCards({ ...withoutCursor, cursor }, now);
    if (!result.ok) {
      break;
    }
    items.push(...result.value.items);
    if (result.value.nextCursor === null || cursor === requestedCursor) {
      break;
    }
    cursor = result.value.nextCursor;
  }
  return items;
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


