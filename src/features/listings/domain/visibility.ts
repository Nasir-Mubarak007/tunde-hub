/**
 * Visibility rules for listings.
 * Cards are public. Full detail needs a signed in buyer.
 * Pending, soft deleted and unknown slugs are 404 to everyone but the owner.
 * Sold rows stay visible inside the window, then drop off on their own.
 */
import { assertNever } from "./result";
import type { Listing } from "./listing";

/**
 * Days a sold listing stays visible on the public site. This is the owned
 * value, not a placeholder: both the card query and the detail gate read it,
 * so cards and detail always agree on when a sale drops off.
 */
export const SOLD_WINDOW_DAYS = 7;

/** Who is looking. The owner sees every known slug, others see a subset. */
export type ViewerRole = "owner" | "customer" | "anonymous";

/** Tells whether a role may create, edit, restore, purge or list for the panel. Takes the role, returns the answer. */
export function canManageListings(role: ViewerRole): boolean {
  return role === "owner";
}

/** The only fields visibility needs. A subset keeps callers honest. */
export type VisibleListing = Pick<Listing, "status" | "soldAt" | "deletedAt">;

/** Whole days as milliseconds. Takes days, returns milliseconds. */
function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

/**
 * The oldest sold stamp that still shows. Takes the clock plus an optional
 * window in days, returns the cutoff. The edge is inclusive, so a sale is
 * visible for exactly the window and drops the moment it passes.
 */
export function soldWindowCutoff(now: Date, soldWindowDays: number = SOLD_WINDOW_DAYS): Date {
  return new Date(now.getTime() - daysToMs(soldWindowDays));
}

/** Tells whether a card shows publicly. Takes the listing plus the clock, returns the answer. */
export function isPublicCardVisible(listing: VisibleListing, now: Date, soldWindowDays: number = SOLD_WINDOW_DAYS): boolean {
  if (listing.deletedAt !== null) {
    return false;
  }
  switch (listing.status) {
    case "available":
      return true;
    case "pending":
      return false;
    case "sold": {
      if (listing.soldAt === null) {
        return false;
      }
      const ageMs = now.getTime() - listing.soldAt.getTime();
      if (ageMs < 0) {
        return true;
      }
      return ageMs <= daysToMs(soldWindowDays);
    }
    default:
      return assertNever(listing.status);
  }
}

/** Tells whether full detail shows. Takes the viewer plus the listing, returns the answer. */
export function canViewListingDetail(
  viewer: ViewerRole,
  listing: VisibleListing,
  now: Date,
  soldWindowDays: number = SOLD_WINDOW_DAYS,
): boolean {
  if (viewer === "owner") {
    return true;
  }
  if (listing.deletedAt !== null) {
    return false;
  }
  switch (listing.status) {
    case "available":
      return viewer === "customer";
    case "pending":
      return false;
    case "sold":
      return viewer === "customer" && isPublicCardVisible(listing, now, soldWindowDays);
    default:
      return assertNever(listing.status);
  }
}
