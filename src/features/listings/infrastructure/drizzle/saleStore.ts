/**
 * Drizzle implementation of the four owner moves.
 * Each move is a single conditional update that names the state the row
 * must still be in, so the first press wins and a stale press writes
 * nothing and reads back null. Every timestamp comes from the database
 * clock, never from a caller. Storage failures throw; domain refusals
 * stay values.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/infrastructure/database/db";
import type { Listing } from "../../domain/listing";
import type { ListingStatus } from "../../domain/listingStatus";
import type { ListingSaleStore } from "../../domain/repositories";
import { listings } from "./schema";
import { toListing } from "./listingMapper";

/** The database clock. Every stamp a transition writes comes from here, never from a caller. */
const databaseNow = sql`now()`;

/** The columns one owner move may write. Keeps each move honest about its own scope. */
interface SaleWrite {
  readonly status: ListingStatus;
  readonly soldAt?: Date | SQL | null;
  readonly claimedByUserId?: string | null;
  readonly claimToken?: string | null;
  readonly pendingSince?: Date | SQL | null;
}

/**
 * Runs one conditional move. Takes the id, the state the row must still be
 * in, and the columns to write. Returns the saved row, or null when the row
 * had already moved or is soft deleted, which is the stale press signal.
 */
async function moveRow(
  listingId: number,
  expected: ListingStatus,
  write: SaleWrite,
): Promise<Listing | null> {
  const rows = await db
    .update(listings)
    .set({ ...write, updatedAt: databaseNow })
    .where(and(eq(listings.id, listingId), eq(listings.status, expected), isNull(listings.deletedAt)))
    .returning();
  const row = rows[0];
  return row === undefined ? null : toListing(row);
}

/** Confirms a pending listing as sold, keeping the holder. Takes the id, returns the row or null. */
export async function confirmSold(listingId: number): Promise<Listing | null> {
  return moveRow(listingId, "pending", { status: "sold", soldAt: databaseNow });
}

/** Sells an available listing straight to sold, naming no holder. Takes the id, returns the row or null. */
export async function markSoldDirect(listingId: number): Promise<Listing | null> {
  return moveRow(listingId, "available", { status: "sold", soldAt: databaseNow });
}

/** Releases a pending listing back to available, clearing the claim columns. Takes the id, returns the row or null. */
export async function releaseClaim(listingId: number): Promise<Listing | null> {
  return moveRow(listingId, "pending", {
    status: "available",
    claimedByUserId: null,
    claimToken: null,
    pendingSince: null,
  });
}

/** Reopens a sold listing back to available, clearing the sold stamp and the claim columns. Takes the id, returns the row or null. */
export async function reopenSold(listingId: number): Promise<Listing | null> {
  return moveRow(listingId, "sold", {
    status: "available",
    soldAt: null,
    claimedByUserId: null,
    claimToken: null,
    pendingSince: null,
  });
}

/** The sale port, assembled from the functions above. */
export const listingSaleStore: ListingSaleStore = {
  confirmSold,
  markSoldDirect,
  releaseClaim,
  reopenSold,
};
