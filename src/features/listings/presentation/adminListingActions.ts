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
  getAdminOverviewAction,
  getListingForOwnerEdit,
  listListingsForAdminAction,
  purgeListingForOwnerAction,
  restoreListingForOwnerAction,
  softDeleteListingForOwnerAction,
  updateListingForOwnerAction,
} from "../infrastructure/container";
import type { AdminStatusFilter } from "../domain/repositories";


/** What a panel form action returns. The form prints issues beside inputs. */
export interface AdminFormResult {
  readonly ok: boolean;
  readonly issues?: readonly FieldIssue[];
  readonly message?: string;
  readonly slug?: string;
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
