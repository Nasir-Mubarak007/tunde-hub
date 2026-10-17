/**
 * The owner panel server actions.
 * Each action checks the owner session first, then parses the panel input
 * and calls the ready use case in the container. Domain refusals come back
 * as values the form can print, never as thrown errors.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerViewer } from "@/features/auth/presentation/ownerGuard";
import {
  parseCreateListingCommand,
  parseUpdateListingCommand,
} from "../application/listingWriteInput";
import type { FieldIssue } from "../application/listingWriteInput";
import {
  createListingForOwnerAction,
  bulkConfirmSoldForOwnerAction,
  bulkReleaseForOwnerAction,
  confirmSoldForOwnerAction,
  getAdminOverviewAction,
  getListingForOwnerEdit,
  listListingsForAdminAction,
  markSoldDirectForOwnerAction,
  purgeListingForOwnerAction,
  releaseListingForOwnerAction,
  reopenSoldForOwnerAction,
  restoreListingForOwnerAction,
  softDeleteListingForOwnerAction,
  updateListingForOwnerAction,
} from "../infrastructure/container";
import type { BulkSaleError, BulkSaleInput, BulkSaleOutput, SaleMoveError, SaleMoveInput } from "../application/saleLifecycle";
import { assertNever } from "../domain/result";
import type { Result } from "../domain/result";
import type { Listing } from "../domain/listing";
import type { AdminStatusFilter } from "../domain/repositories";


/** What a panel form action returns. The form prints issues beside inputs. */
export interface AdminFormResult {
  readonly ok: boolean;
  readonly issues?: readonly FieldIssue[];
  readonly message?: string;
  readonly slug?: string;
}

/** What one owner move returns. The row prints the message under the buttons. */
export interface SaleActionResult {
  readonly ok: boolean;
  readonly message: string;
}

/** What one bulk press returns. The bar prints the counts under the buttons. */
export interface BulkSaleActionResult {
  readonly ok: boolean;
  readonly message: string;
  readonly moved: number;
  readonly skipped: number;
}

/** Words for a refused owner move. Takes the reason, returns what the panel shows. */
function saleMoveMessage(error: SaleMoveError): string {
  switch (error) {
    case "not-owner":
      return "Only the owner can do that.";
    case "listing-not-found":
      return "That listing is gone.";
    case "wrong-state":
      return "That listing is not in a state for that move.";
    case "just-changed":
      return "That listing just changed. The panel now shows where it actually is.";
    default:
      return assertNever(error);
  }
}

/** Words for a refused bulk press. Takes the reason, returns what the panel shows. */
function bulkSaleMessage(error: BulkSaleError): string {
  switch (error) {
    case "not-owner":
      return "Only the owner can do that.";
    case "empty-selection":
      return "Pick at least one listing first.";
    case "too-many-selected":
      return "That is more than 50 listings. Do them in smaller batches.";
    default:
      return assertNever(error);
  }
}

/** Turns a domain issue list into field issues. Takes the issues, returns printable rows. */
function domainIssuesToFields(
  issues: readonly string[],
  resolve: (issue: string) => { readonly field: string; readonly message: string },
): readonly FieldIssue[] {
  return issues.map((issue) => resolve(issue));
}

/** Maps one listing issue to a field plus words. Takes the issue, returns the printable row. */
function listingIssueToField(issue: string): { readonly field: string; readonly message: string } {
  switch (issue) {
    case "title-required":
      return { field: "title", message: "A title is required." };
    case "slug-required":
    case "slug-invalid":
      return { field: "title", message: "That title cannot make a link. Change it and try again." };
    case "platform-unknown":
      return { field: "platform", message: "Pick a supported platform." };
    case "price-invalid":
      return { field: "priceAmount", message: "Price must be zero or more." };
    case "currency-invalid":
      return { field: "currency", message: "Currency is three uppercase letters." };
    case "follower-count-invalid":
      return { field: "followerCount", message: "Follower count must be zero or more." };
    case "account-age-invalid":
      return { field: "accountAgeMonths", message: "Account age must be zero or more." };
    default:
      return { field: "title", message: "That value did not pass. Check it and try again." };
  }
}

/** Maps one image issue to words on the images field. Takes the issue, returns the printable row. */
function imageIssueToField(issue: string): { readonly field: string; readonly message: string } {
  switch (issue) {
    case "too-many-screenshots":
      return { field: "images", message: "At most six screenshots." };
    case "incomplete-width-set":
      return { field: "images", message: "Each screenshot needs all three widths. Reupload it." };
    case "duplicate-variant":
      return { field: "images", message: "Two files cover the same slot. Remove one and try again." };
    case "width-unsupported":
      return { field: "images", message: "Photos use widths 320, 768, and 1200 only." };
    case "position-out-of-range":
    case "position-not-integer":
      return { field: "images", message: "Photo order looks off. Remove and readd the photos." };
    case "width-not-integer":
      return { field: "images", message: "Photo width looks off. Reupload the photos." };
    case "url-required":
      return { field: "images", message: "One photo is missing its link. Reupload it." };
    default:
      return { field: "images", message: "Those photos did not pass. Reupload them." };
  }
}

/** Creates one listing from the panel form. Takes the raw form object, returns the outcome. */
export async function createListingFromForm(input: unknown): Promise<AdminFormResult> {
  const viewer = await requireOwnerViewer("/admin/listings/new");
  const parsed = parseCreateListingCommand(input);
  if (!parsed.ok) {
    return { ok: false, issues: parsed.issues };
  }
  const result = await createListingForOwnerAction(
    { actorRole: viewer.role, command: parsed.value },
    new Date(),
  );
  if (!result.ok) {
    if (result.error === "not-owner") {
      return { ok: false, message: "Only the owner can add listings." };
    }
    if (result.error === "slug-space-exhausted") {
      return { ok: false, message: "That title collides too often. Change the title and try again." };
    }
    if ("issues" in result.error) {
      return { ok: false, issues: domainIssuesToFields(result.error.issues, listingIssueToField) };
    }
    return { ok: false, issues: domainIssuesToFields(result.error.imageIssues, imageIssueToField) };
  }
  revalidatePath("/admin");
  return { ok: true, slug: result.value.slug };
}

/** Updates one listing from the panel form. Takes the id plus the raw form object, returns the outcome. */
export async function updateListingFromForm(listingId: number, input: unknown): Promise<AdminFormResult> {
  const viewer = await requireOwnerViewer(`/admin/listings/${listingId}/edit`);
  const parsed = parseUpdateListingCommand(input);
  if (!parsed.ok) {
    return { ok: false, issues: parsed.issues };
  }
  const result = await updateListingForOwnerAction(
    { actorRole: viewer.role, listingId, command: parsed.value },
    new Date(),
  );
  if (!result.ok) {
    if (result.error === "not-owner") {
      return { ok: false, message: "Only the owner can edit listings." };
    }
    if (result.error === "listing-not-found") {
      return { ok: false, message: "That listing is gone." };
    }
    if ("issues" in result.error) {
      return { ok: false, issues: domainIssuesToFields(result.error.issues, listingIssueToField) };
    }
    return { ok: false, issues: domainIssuesToFields(result.error.imageIssues, imageIssueToField) };
  }
  revalidatePath("/admin");
  return { ok: true, slug: result.value.slug };
}

/** Reads the listing id from a row form. Takes the form data, returns the id or null. */
function listingIdFrom(formData: FormData): number | null {
  const raw = formData.get("listingId");
  const id = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isInteger(id) ? id : null;
}

/** Soft deletes one listing from a row button. Takes the form data, returns nothing. */
export async function softDeleteListingFormAction(formData: FormData): Promise<void> {
  const viewer = await requireOwnerViewer("/admin");
  const listingId = listingIdFrom(formData);
  if (listingId === null) {
    return;
  }
  await softDeleteListingForOwnerAction({ actorRole: viewer.role, listingId }, new Date());
  revalidatePath("/admin");
}

/** Restores one soft deleted listing from a row button. Takes the form data, returns nothing. */
export async function restoreListingFormAction(formData: FormData): Promise<void> {
  const viewer = await requireOwnerViewer("/admin");
  const listingId = listingIdFrom(formData);
  if (listingId === null) {
    return;
  }
  await restoreListingForOwnerAction({ actorRole: viewer.role, listingId }, new Date());
  revalidatePath("/admin");
}

/** Purges one listing for good from a row button. Takes the form data, returns nothing. */
export async function purgeListingFormAction(formData: FormData): Promise<void> {
  const viewer = await requireOwnerViewer("/admin");
  const listingId = listingIdFrom(formData);
  if (listingId === null) {
    return;
  }
  await purgeListingForOwnerAction({ actorRole: viewer.role, listingId });
  revalidatePath("/admin");
}

/**
 * Refreshes every page a lifecycle move changes. Takes the slug when the move
 * named one. A move never leaves the shop grid or the listing page showing a
 * state the row has already left.
 */
function revalidateSalePages(slug: string | null): void {
  revalidatePath("/admin");
  revalidatePath("/");
  if (slug === null) {
    revalidatePath("/listings/[slug]", "page");
    return;
  }
  revalidatePath(`/listings/${slug}`);
}

/** One owner move as the container exposes it. Takes the input plus the clock, returns the row or the reason. */
type SaleRowMove = (input: SaleMoveInput, now: Date) => Promise<Result<Listing, SaleMoveError>>;

/** One bulk move as the container exposes it. Takes the input plus the clock, returns the counts or the reason. */
type BulkMove = (input: BulkSaleInput, now: Date) => Promise<Result<BulkSaleOutput, BulkSaleError>>;

/** One owner move wired to a row button. Takes the listing id and the move, returns the words to show. */
async function runSaleRowAction(listingId: number, move: SaleRowMove): Promise<SaleActionResult> {
  const viewer = await requireOwnerViewer("/admin");
  const result = await move({ actorRole: viewer.role, actorId: viewer.userId, listingId }, new Date());
  revalidateSalePages(result.ok ? result.value.slug : null);
  if (!result.ok) {
    return { ok: false, message: saleMoveMessage(result.error) };
  }
  return { ok: true, message: "Done." };
}

/** Confirms a pending listing as sold from a row button. Takes the listing id, returns the words to show. */
export async function confirmSoldFormAction(listingId: number): Promise<SaleActionResult> {
  return runSaleRowAction(listingId, confirmSoldForOwnerAction);
}

/** Releases a pending listing back to available from a row button. Takes the listing id, returns the words to show. */
export async function releaseListingFormAction(listingId: number): Promise<SaleActionResult> {
  return runSaleRowAction(listingId, releaseListingForOwnerAction);
}

/** Sells an available listing straight to sold from a row button. Takes the listing id, returns the words to show. */
export async function markSoldDirectFormAction(listingId: number): Promise<SaleActionResult> {
  return runSaleRowAction(listingId, markSoldDirectForOwnerAction);
}

/** Reopens a sold listing back to available from a row button. Takes the listing id, returns the words to show. */
export async function reopenSoldFormAction(listingId: number): Promise<SaleActionResult> {
  return runSaleRowAction(listingId, reopenSoldForOwnerAction);
}

/**
 * One bulk press wired to the panel bar. Takes the ticked ids and the move,
 * returns the counts plus the words to show. The panel grid and every listing
 * page are refreshed afterwards because a bulk press never names one slug.
 */
async function runBulkSaleAction(listingIds: readonly number[], move: BulkMove): Promise<BulkSaleActionResult> {
  const viewer = await requireOwnerViewer("/admin");
  if (listingIds.length === 0) {
    return { ok: false, message: bulkSaleMessage("empty-selection"), moved: 0, skipped: 0 };
  }
  const result = await move({ actorRole: viewer.role, actorId: viewer.userId, listingIds }, new Date());
  revalidateSalePages(null);
  if (!result.ok) {
    return { ok: false, message: bulkSaleMessage(result.error), moved: 0, skipped: listingIds.length };
  }
  const { moved, skipped } = result.value;
  const message =
    skipped === 0
      ? `Moved ${moved} ${moved === 1 ? "listing" : "listings"}.`
      : `Moved ${moved}. Left ${skipped}, already moved on by someone else.`;
  return { ok: true, message, moved, skipped };
}

/** Confirms every ticked pending listing as sold. Takes the ticked ids, returns the counts plus the words to show. */
export async function bulkConfirmSoldFormAction(listingIds: readonly number[]): Promise<BulkSaleActionResult> {
  return runBulkSaleAction(listingIds, bulkConfirmSoldForOwnerAction);
}

/** Releases every ticked pending listing back to available. Takes the ticked ids, returns the counts plus the words to show. */
export async function bulkReleaseFormAction(listingIds: readonly number[]): Promise<BulkSaleActionResult> {
  return runBulkSaleAction(listingIds, bulkReleaseForOwnerAction);
}

/** Reexports the admin list read for the panel page. Kept here so the page imports one module. */
export async function readAdminList(cursor?: string, status: AdminStatusFilter = "all") {
  const viewer = await requireOwnerViewer("/admin");
  const [page, overview] = await Promise.all([
    listListingsForAdminAction({ actorRole: viewer.role, cursor, status }),
    getAdminOverviewAction(viewer.role),
  ]);
  return { viewer, page, overview, status };
}

/** Reexports the edit payload read for the edit page. Kept here so the page imports one module. */
export async function readListingForEdit(listingId: number) {
  const viewer = await requireOwnerViewer(`/admin/listings/${listingId}/edit`);
  return {
    viewer,
    payload: await getListingForOwnerEdit(listingId, viewer.role),
  };
}
