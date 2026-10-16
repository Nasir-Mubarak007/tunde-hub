/**
 * The four owner moves plus their bulk form.
 * Every move is owner only, is one conditional write naming the state the
 * row must still be in, and refuses a soft deleted row. A press that races
 * another press writes nothing and comes back as just changed, so the first
 * write wins. Each accepted move is recorded once the row has moved.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import type { Listing, ListingTransitionError } from "../domain/listing";
import { confirmSold, markSoldDirect, releaseClaim, reopenSold } from "../domain/listing";
import type { ListingStatus } from "../domain/listingStatus";
import { canManageListings } from "../domain/visibility";
import type { ViewerRole } from "../domain/visibility";
import type { ListingRepository, ListingSaleStore, TransitionLog } from "../domain/repositories";

/** How many listings one bulk press may carry. Anything past this is refused whole. */
export const BULK_SALE_LIMIT = 50;

/** Deps. Takes the read port, the conditional write port and the log sink, returns them wired. */
export interface SaleLifecycleDeps {
  readonly listings: ListingRepository;
  readonly sales: ListingSaleStore;
  readonly transitions: TransitionLog;
}

/** Input for one owner move. The actor id names who pressed, for the log. */
export interface SaleMoveInput {
  readonly actorRole: ViewerRole;
  readonly actorId: string;
  readonly listingId: number;
}

/**
 * Why one move is refused. Just changed is the stale press: the row had
 * already moved by the time the conditional write ran.
 */
export type SaleMoveError = "not-owner" | "listing-not-found" | "wrong-state" | "just-changed";

/** The domain guard for one move. Takes a listing plus the clock, returns the next copy or the reason. */
type SaleGuard = (listing: Listing, now: Date) => Result<Listing, ListingTransitionError>;

/** The conditional write for one move. Takes the id, returns the row or null when it had already moved. */
type SaleWrite = (listingId: number) => Promise<Listing | null>;

/**
 * Runs one owner move end to end. Takes the deps, the input, the clock, the
 * domain guard, the conditional write and the state the move lands on.
 * Returns the moved row or the reason.
 */
async function runSaleMove(
  deps: SaleLifecycleDeps,
  input: SaleMoveInput,
  now: Date,
  guard: SaleGuard,
  write: SaleWrite,
  to: ListingStatus,
): Promise<Result<Listing, SaleMoveError>> {
  if (!canManageListings(input.actorRole)) {
    return err("not-owner");
  }
  const current = await deps.listings.findById(input.listingId);
  if (current === null || current.deletedAt !== null) {
    return err("listing-not-found");
  }
  if (!guard(current, now).ok) {
    return err("wrong-state");
  }
  const saved = await write(current.id);
  if (saved === null) {
    return err("just-changed");
  }
  deps.transitions.write({ listingId: saved.id, from: current.status, to, actorId: input.actorId });
  return ok(saved);
}

/** Confirms a pending listing as sold, keeping the holder on the row. Takes deps plus input plus the clock, returns the row or the reason. */
export async function confirmSoldForOwner(
  deps: SaleLifecycleDeps,
  input: SaleMoveInput,
  now: Date,
): Promise<Result<Listing, SaleMoveError>> {
  return runSaleMove(deps, input, now, confirmSold, deps.sales.confirmSold, "sold");
}

/** Sells an available listing straight to sold, for a deal agreed off the site. Takes deps plus input plus the clock, returns the row or the reason. */
export async function markSoldDirectForOwner(
  deps: SaleLifecycleDeps,
  input: SaleMoveInput,
  now: Date,
): Promise<Result<Listing, SaleMoveError>> {
  return runSaleMove(deps, input, now, markSoldDirect, deps.sales.markSoldDirect, "sold");
}

/** Releases a pending listing back to available, clearing the holder and the token. Takes deps plus input plus the clock, returns the row or the reason. */
export async function releaseListingForOwner(
  deps: SaleLifecycleDeps,
  input: SaleMoveInput,
  now: Date,
): Promise<Result<Listing, SaleMoveError>> {
  return runSaleMove(deps, input, now, releaseClaim, deps.sales.releaseClaim, "available");
}

/** Reopens a sold listing back to available, for a sale the owner called off. Takes deps plus input plus the clock, returns the row or the reason. */
export async function reopenSoldForOwner(
  deps: SaleLifecycleDeps,
  input: SaleMoveInput,
  now: Date,
): Promise<Result<Listing, SaleMoveError>> {
  return runSaleMove(deps, input, now, reopenSold, deps.sales.reopenSold, "available");
}

/** Input for a bulk press. Ids arrive as given and are folded in order. */
export interface BulkSaleInput {
  readonly actorRole: ViewerRole;
  readonly actorId: string;
  readonly listingIds: readonly number[];
}

/** What one bulk press refuses before it touches a row. */
export type BulkSaleError = "not-owner" | "empty-selection" | "too-many-selected";

/** What one row of a bulk press did. A bad row is its own result and never blocks the rest. */
export type BulkRowResult =
  | { readonly listingId: number; readonly ok: true }
  | { readonly listingId: number; readonly ok: false; readonly reason: SaleMoveError };

/** What a bulk press returns. The results in the order asked for, plus how many rows moved. */
export interface BulkSaleOutput {
  readonly results: readonly BulkRowResult[];
  readonly moved: number;
  readonly skipped: number;
}

/** One bulk move. Takes a deps plus input plus a clock, runs the move on every row. */
type BulkMove = (
  deps: SaleLifecycleDeps,
  input: SaleMoveInput,
  now: Date,
) => Promise<Result<Listing, SaleMoveError>>;

/**
 * Folds duplicates while keeping the order asked for. Takes the raw ids,
 * returns the distinct ids in order.
 */
function foldListingIds(raw: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  const folded: number[] = [];
  for (const id of raw) {
    if (!seen.has(id)) {
      seen.add(id);
      folded.push(id);
    }
  }
  return folded;
}

/**
 * Runs one move over many listings, best effort. Takes the deps, the input,
 * the clock and the single move to run. Returns a result per row: a row that
 * refused never stops the rows around it.
 */
async function runBulkMove(
  deps: SaleLifecycleDeps,
  input: BulkSaleInput,
  now: Date,
  move: BulkMove,
): Promise<Result<BulkSaleOutput, BulkSaleError>> {
  if (!canManageListings(input.actorRole)) {
    return err("not-owner");
  }
  const listingIds = foldListingIds(input.listingIds);
  if (listingIds.length === 0) {
    return err("empty-selection");
  }
  if (listingIds.length > BULK_SALE_LIMIT) {
    return err("too-many-selected");
  }
  const results: BulkRowResult[] = [];
  let moved = 0;
  for (const listingId of listingIds) {
    const result = await move(deps, { actorRole: input.actorRole, actorId: input.actorId, listingId }, now);
    if (result.ok) {
      moved += 1;
      results.push({ listingId, ok: true });
    } else {
      results.push({ listingId, ok: false, reason: result.error });
    }
  }
  return ok({ results, moved, skipped: results.length - moved });
}

/** Confirms many pending listings as sold, best effort. Takes deps plus input plus the clock, returns a result per row. */
export async function bulkConfirmSoldForOwner(
  deps: SaleLifecycleDeps,
  input: BulkSaleInput,
  now: Date,
): Promise<Result<BulkSaleOutput, BulkSaleError>> {
  return runBulkMove(deps, input, now, confirmSoldForOwner);
}

/** Releases many pending listings back to available, best effort. Takes deps plus input plus the clock, returns a result per row. */
export async function bulkReleaseForOwner(
  deps: SaleLifecycleDeps,
  input: BulkSaleInput,
  now: Date,
): Promise<Result<BulkSaleOutput, BulkSaleError>> {
  return runBulkMove(deps, input, now, releaseListingForOwner);
}
