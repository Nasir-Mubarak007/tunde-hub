/**
 * The admin listing list use case.
 * Owner only, and it covers every listing including soft deleted ones, so
 * the panel can restore or purge. Paging is the same keyset cursor the
 * public grid uses, on created_at and id, newest first, so a row never
 * shifts under the owner while they work. The page size is fixed here, as
 * it is for the public list, and can change without a migration.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import { canManageListings } from "../domain/visibility";
import type { ViewerRole } from "../domain/visibility";
import type { AdminListingQuery, AvailableCursor } from "../domain/repositories";
import { toAdminListingDto } from "./adminListingDto";
import type { AdminListingDto } from "./adminListingDto";

/** Page size for the admin list. Fixed per spec, no client paging input. */
export const ADMIN_PAGE_SIZE = 20;

/** Deps. Takes the admin read port, returned as is. */
export interface ListForAdminDeps {
  readonly listings: AdminListingQuery;
}

/** Input. Takes the actor role plus an optional cursor plus the page size. */
export interface ListForAdminInput {
  readonly actorRole: ViewerRole;
  readonly cursor?: string;
  readonly limit?: number;
}

/** What a page returns. The items plus the cursor for the next page, null at the end. */
export interface ListForAdminOutput {
  readonly items: readonly AdminListingDto[];
  readonly nextCursor: string | null;
}

/** Why the list is refused. Only the owner role. */
export type ListForAdminError = "not-owner" | "cursor-invalid";

/** Encodes the next cursor. Takes the row, returns the opaque cursor. */
function encodeCursor(row: AdminListingDto): string {
  return btoa(JSON.stringify({ v: row.createdAt.toISOString(), id: row.id }));
}

/** Decodes a cursor. Takes the raw value, returns the parsed cursor or null. */
function decodeCursor(raw: string): AvailableCursor | null {
  try {
    const parsed: unknown = JSON.parse(atob(raw));
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as { v?: unknown; id?: unknown };
    if (typeof record.v !== "string" || !Number.isInteger(record.id)) {
      return null;
    }
    const time = Date.parse(record.v);
    if (Number.isNaN(time)) {
      return null;
    }
    return { sortKey: new Date(time), id: record.id as number };
  } catch {
    return null;
  }
}

/** Lists one page of listings for the panel. Takes deps plus input, returns the page or the reason. */
export async function listListingsForAdmin(
  deps: ListForAdminDeps,
  input: ListForAdminInput,
): Promise<Result<ListForAdminOutput, ListForAdminError>> {
  if (!canManageListings(input.actorRole)) {
    return err("not-owner");
  }
  let cursor: AvailableCursor | null = null;
  if (input.cursor !== undefined && input.cursor.length > 0) {
    cursor = decodeCursor(input.cursor);
    if (cursor === null) {
      return err("cursor-invalid");
    }
  }

  const limit = input.limit ?? ADMIN_PAGE_SIZE;
  const rows = await deps.listings.listAllForAdmin({ cursor, limit: limit + 1 });
  const items = rows.slice(0, limit).map(toAdminListingDto);
  const last = items[items.length - 1];
  const nextCursor = rows.length > limit && last !== undefined ? encodeCursor(last) : null;
  return ok({ items, nextCursor });
}