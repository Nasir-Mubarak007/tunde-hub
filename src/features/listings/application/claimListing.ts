/**
 * The claim use case.
 * Thin orchestrator: checks the pure guard, then asks the claim store for
 * the one atomic write that decides the outcome. The store also records the
 * click in the same transaction, so a refused claim still counts.
 * A successful claim returns the chat message; the link is built by the caller.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import type { UserRole } from "@/features/auth/domain/userRole";
import { canClaimListing } from "../domain/claim";
import type { ClaimRefusalReason, ClaimantRole } from "../domain/claim";
import { RATE_LIMIT_MESSAGE, isRateLimited } from "../domain/rateLimit";
import type { ClaimAttemptInput, ClaimClick, ClaimStore, ListingQuery, ListingRepository, RateLimitStore } from "../domain/repositories";
import { formatListingPrice } from "../domain/listing";
import { buildClaimMessage } from "../domain/claimMessage";

/** Who is pressing. The session supplies these facts, never the form. */
export interface ClaimBuyer {
  readonly userId: string;
  readonly role: UserRole;
  readonly displayName: string | null;
  readonly email: string;
}

/** Input for one press. Takes the listing plus the buyer plus the visitor click. */
export interface ClaimListingInput {
  readonly listingId: number;
  readonly buyer: ClaimBuyer;
  readonly click: ClaimClick | null;
}

/** What a press produced. Takes nothing, returned on success. */
export interface ClaimListingSuccess {
  readonly slug: string;
  readonly message: string;
}

/** Why a press was refused. The slug travels with it so the caller can go back. */
export interface ClaimListingRefusal {
  readonly reason: ClaimRefusalReason | "rate-limited" | "listing-not-found";
  readonly slug: string | null;
  readonly message: string;
}

/** The outcome of one press. Takes nothing, returned by the use case. */
export type ClaimListingResult = Result<ClaimListingSuccess, ClaimListingRefusal>;

/** Deps. Takes the read ports, the write ports and the token factory. */
export interface ClaimListingDeps {
  readonly listings: ListingRepository;
  readonly query: ListingQuery;
  readonly claims: ClaimStore;
  readonly rateLimit: RateLimitStore;
  readonly newClaimToken: () => string;
}

/** Maps a session role onto the guard's role. Takes the role, returns the guard role. */
function toClaimantRole(role: UserRole): ClaimantRole {
  return role;
}

/** Builds the copy for a guard refusal. Takes the reason, returns the message. */
function messageFor(reason: ClaimRefusalReason, slug: string | null): ClaimListingRefusal {
  const copy: Record<ClaimRefusalReason, string> = {
    "anonymous-cannot-claim": "Sign in to claim this account.",
    "owner-cannot-claim": "The owner cannot claim a listing.",
    "listing-deleted": "This listing is no longer available.",
    "already-holds-this-listing": "You already hold this listing.",
    "listing-taken": "This listing was just taken.",
    "already-has-pending-claim": "You already hold a pending claim.",
  };
  return { reason, slug, message: copy[reason] };
}

/** Claims one listing for one buyer. Takes deps plus input plus the clock, returns the outcome as a value. */
export async function claimListing(
  deps: ClaimListingDeps,
  input: ClaimListingInput,
  now: Date,
): Promise<ClaimListingResult> {
  const listing = await deps.listings.findById(input.listingId);
  if (listing === null) {
    return err({ reason: "listing-not-found", slug: null, message: "This listing is no longer available." });
  }

  const buyerHasPendingClaim = await deps.query.hasPendingClaimFor(input.buyer.userId);
  const eligible = canClaimListing({
    listing,
    claimantRole: toClaimantRole(input.buyer.role),
    claimantUserId: input.buyer.userId,
    buyerHasPendingClaim,
  });
  if (!eligible.ok) {
    // A refused press still counts toward the hourly cap, so record the click
    // here too. No claim write happens on this path, so there is nothing to share
    // a transaction with.
    if (input.click !== null) {
      const count = await deps.rateLimit.incrementAndGetCount(input.click.visitorHash, input.click.bucket);
      if (isRateLimited(count)) {
        return err({ reason: "rate-limited", slug: listing.slug, message: RATE_LIMIT_MESSAGE });
      }
    }
    return err(messageFor(eligible.error, listing.slug));
  }

  const attempt: ClaimAttemptInput = {
    listingId: listing.id,
    buyerId: input.buyer.userId,
    token: deps.newClaimToken(),
    now,
    click: input.click,
  };
  const outcome = await deps.claims.attemptClaim(attempt);

  switch (outcome.outcome) {
    case "claimed":
      return ok({
        slug: outcome.listing.slug,
        message: buildClaimMessage({
          displayName: input.buyer.displayName ?? input.buyer.email,
          title: outcome.listing.title,
          slug: outcome.listing.slug,
          price: formatListingPrice(outcome.listing.priceAmount, outcome.listing.currency),
        }),
      });
    case "taken":
      return err({ reason: "listing-taken", slug: listing.slug, message: "This listing was just taken." });
    case "buyer-capped":
      return err(messageFor("already-has-pending-claim", listing.slug));
    case "rate-limited":
      return err({ reason: "rate-limited", slug: listing.slug, message: RATE_LIMIT_MESSAGE });
  }
}

