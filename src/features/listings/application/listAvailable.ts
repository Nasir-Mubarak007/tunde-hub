/**
 * Public card list use case.
 * Thin orchestrator: validates the boundary input, asks the query port,
 * reads one extra row for next page detection, returns card DTOs.
 * Public, no sign in needed. Visibility plus the sold window are enforced
 * by the query port, never by filtering in memory.
 */
import type { Result } from "../domain/result";
import { err, ok } from "../domain/result";
import { isPlatform } from "../domain/platform";
import type { Platform } from "../domain/platform";
import type {
  AvailableCursor,
  AvailableSort,
  ListingQuery,
  SortDirection,
} from "../domain/repositories";
import { soldWindowCutoff } from "../domain/visibility";
import type { Listing } from "../domain/listing";
import { toCardDto } from "./listingDto";
import type { ListingCardDto } from "./listingDto";

/** Page size for the card list. Fixed per spec, takes no client paging input. */
export const CARD_PAGE_SIZE = 20;

/** Sort orders the boundary accepts. Newest first is the default. */
const SORTS: readonly string[] = ["newest", "price", "followers", "age"];

/** Raw boundary input. Values stay raw so failures are values, never throws. */
export interface ListAvailableInput {
  readonly platform?: string;
  readonly maxPrice?: number;
  readonly minFollowers?: number;
  readonly sort?: string;
  readonly direction?: string;
  readonly cursor?: string;
}

/** One page of cards plus the opaque cursor for the next page, when one exists. */
export interface ListAvailableOutput {
  readonly items: readonly ListingCardDto[];
  readonly nextCursor: string | null;
}

/** Why the input is refused. Returned as a value, never thrown. */
export type ListAvailableError =
  | "platform-unknown"
  | "sort-unknown"
  | "direction-unknown"
  | "filter-invalid"
  | "cursor-invalid";

/** Deps. Takes the query port only. */
export interface ListAvailableDeps {
  readonly listings: ListingQuery;
}

/** Reads the sort key for cursor building. Takes the listing plus the sort, returns the key. */
function sortKeyFor(listing: Listing, sort: AvailableSort): Date | number {
  switch (sort) {
    case "newest":
      return listing.createdAt;
    case "price":
      return listing.priceAmount;
    case "followers":
      return listing.followerCount;
    case "age":
      return listing.accountAgeMonths;
  }
}

/** Encodes an opaque page cursor. Takes the sort key plus the id, returns the cursor. */
function encodeCursor(sortKey: Date | number, id: number): string {
  const raw = sortKey instanceof Date ? sortKey.toISOString() : sortKey;
  return btoa(JSON.stringify({ v: raw, id }));
}

/** Decodes an opaque page cursor. Takes the raw cursor plus the sort, returns the cursor or null. */
function decodeCursor(raw: string, sort: AvailableSort): AvailableCursor | null {
  try {
    const parsed: unknown = JSON.parse(atob(raw));
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as { v?: unknown; id?: unknown };
    if (!Number.isInteger(record.id)) {
      return null;
    }
    const id = record.id as number;
    if (sort === "newest") {
      if (typeof record.v !== "string") {
        return null;
      }
      const time = Date.parse(record.v);
      if (Number.isNaN(time)) {
        return null;
      }
      return { sortKey: new Date(time), id };
    }
    if (typeof record.v !== "number") {
      return null;
    }
    return { sortKey: record.v, id };
  } catch {
    return null;
  }
}

/** Checks an optional whole non negative filter. Takes the value, returns true when usable. */
function isValidFilterNumber(value: number | undefined): value is number {
  return value === undefined || (Number.isInteger(value) && value >= 0);
}

/** Lists one page of public cards. Takes deps plus input plus the clock, returns the page or the reason. */
export async function listAvailable(
  deps: ListAvailableDeps,
  input: ListAvailableInput,
  now: Date,
): Promise<Result<ListAvailableOutput, ListAvailableError>> {
  let platforms: readonly Platform[] = [];
  if (input.platform !== undefined) {
    if (!isPlatform(input.platform)) {
      return err("platform-unknown");
    }
    platforms = [input.platform];
  }

  let sort: AvailableSort = "newest";
  if (input.sort !== undefined) {
    if (!SORTS.includes(input.sort)) {
      return err("sort-unknown");
    }
    sort = input.sort as AvailableSort;
  }

  let direction: SortDirection = "desc";
  if (input.direction !== undefined) {
    if (input.direction !== "asc" && input.direction !== "desc") {
      return err("direction-unknown");
    }
    direction = input.direction;
  }

  if (!isValidFilterNumber(input.maxPrice) || !isValidFilterNumber(input.minFollowers)) {
    return err("filter-invalid");
  }

  let cursor: AvailableCursor | null = null;
  if (input.cursor !== undefined) {
    const decoded = decodeCursor(input.cursor, sort);
    if (decoded === null) {
      return err("cursor-invalid");
    }
    cursor = decoded;
  }

  const rows = await deps.listings.listAvailableCards({
    platforms,
    maxPrice: input.maxPrice ?? null,
    minFollowers: input.minFollowers ?? null,
    sort,
    direction,
    cursor,
    limit: CARD_PAGE_SIZE + 1,
    soldCutoff: soldWindowCutoff(now),
  });

  const page = rows.slice(0, CARD_PAGE_SIZE);
  const items = page.map((row) => toCardDto(row.listing, row.coverImageUrl));
  const hasMore = rows.length > CARD_PAGE_SIZE;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last !== undefined ? encodeCursor(sortKeyFor(last.listing, sort), last.listing.id) : null;
  return ok({ items, nextCursor });
}
