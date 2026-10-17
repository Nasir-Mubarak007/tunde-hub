/**
 * Lifecycle states for a listing.
 * Sales normally run available to pending to sold.
 * The owner may also sell directly from available.
 * Sold is not terminal: the owner may reopen it back to available.
 */
import { assertNever } from "./result";

/** Every lifecycle state. Takes nothing, used as the source of the union below. */
export const LISTING_STATUSES = ["available", "pending", "sold"] as const;

/** A listing lifecycle state. One of available, pending, sold. */
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Checks a raw string. Takes the candidate, returns true only for a known state. */
export function isListingStatus(value: string): value is ListingStatus {
  return (LISTING_STATUSES as readonly string[]).includes(value);
}

/** Tells whether a move between states is allowed. Takes both states, returns the answer. */
export function canTransitionListingStatus(from: ListingStatus, to: ListingStatus): boolean {
  switch (from) {
    case "available":
      return to === "pending" || to === "sold";
    case "pending":
      return to === "available" || to === "sold";
    case "sold":
      return to === "available";
    default:
      return assertNever(from);
  }
}
