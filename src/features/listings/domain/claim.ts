/**
 * Claim eligibility guard.
 * This is the pure half of the claim rule. It refuses the obvious cases
 * before any write. The atomic conditional update in infrastructure
 * is the backstop that keeps two simultaneous clicks from both succeeding.
 */
import type { Result } from "./result";
import { err, ok } from "./result";
import type { Listing } from "./listing";

/** Who is asking to claim. Only signed in customers may hold a listing. */
export type ClaimantRole = "owner" | "customer" | "anonymous";

/** Why a claim is refused. Returned as a value, never thrown. */
export type ClaimRefusalReason =
  | "anonymous-cannot-claim"
  | "owner-cannot-claim"
  | "listing-deleted"
  | "already-holds-this-listing"
  | "listing-taken"
  | "already-has-pending-claim";

/** Plain facts the guard needs. No database access here. */
export interface ClaimEligibilityInput {
  readonly listing: Listing;
  readonly claimantRole: ClaimantRole;
  readonly claimantUserId: string | null;
  readonly buyerHasPendingClaim: boolean;
}

/** Plain words for each refusal. Takes nothing, keyed by reason. */
export const CLAIM_REFUSAL_MESSAGES: Record<ClaimRefusalReason, string> = {
  "anonymous-cannot-claim": "Sign in to claim this account.",
  "owner-cannot-claim": "The owner cannot claim a listing.",
  "listing-deleted": "This listing is no longer available.",
  "already-holds-this-listing": "You already hold this listing.",
  "listing-taken": "This listing is already taken.",
  "already-has-pending-claim": "You already hold a pending claim.",
};

/** Checks a claim before any write. Takes the listing plus claimant facts, returns true or the reason. */
export function canClaimListing(input: ClaimEligibilityInput): Result<true, ClaimRefusalReason> {
  if (input.claimantRole === "anonymous" || input.claimantUserId === null) {
    return err("anonymous-cannot-claim");
  }
  if (input.claimantRole === "owner") {
    return err("owner-cannot-claim");
  }
  if (input.listing.deletedAt !== null) {
    return err("listing-deleted");
  }
  if (input.listing.claimedByUserId !== null && input.listing.claimedByUserId === input.claimantUserId) {
    return err("already-holds-this-listing");
  }
  if (input.listing.status !== "available") {
    return err("listing-taken");
  }
  if (input.buyerHasPendingClaim) {
    return err("already-has-pending-claim");
  }
  return ok(true);
}
