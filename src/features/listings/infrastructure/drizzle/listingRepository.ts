/**
 * Drizzle implementations of the listing ports.
 * Visibility, the sold window and the keyset cursor live in SQL here,
 * never as in memory filtering. Storage failures throw; domain
 * refusals stay values.
 */
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AnyColumn } from "drizzle-orm";
import { db } from "@/infrastructure/database/db";
import { users } from "@/features/auth/infrastructure/auth-schema";
import type { Result } from "../../domain/result";
import { err, ok } from "../../domain/result";
import type { Listing, NewListing } from "../../domain/listing";
import type {
  AdminListingQuery,
  AdminListingRow,
  AdminListingsQuery,
  AvailableListingsQuery,
  AvailableSort,
  ListingCardRow,
  ListingQuery,
  ListingRepository,
} from "../../domain/repositories";
import { listingImages, listings } from "./schema";
import { toListing } from "./listingMapper";

/** Width used for a card cover. Fixed per spec, one row per screenshot. */
const COVER_WIDTH = 768;

/** Position used for a card cover. Zero is the first screenshot. */
const COVER_POSITION = 0;

/** Finds a listing by id. Takes the id, returns the entity or null. */
async function selectListingById(id: number): Promise<Listing | null> {
  const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  const row = rows[0];
  return row === undefined ? null : toListing(row);
}

/** Finds a listing by slug. Takes the slug, returns the entity or null. */
async function selectListingBySlug(slug: string): Promise<Listing | null> {
  const rows = await db.select().from(listings).where(eq(listings.slug, slug)).limit(1);
  const row = rows[0];
  return row === undefined ? null : toListing(row);
}

/** Finds by id. Takes the id, returns the listing or null. */
export function findById(id: number): Promise<Listing | null> {
  return selectListingById(id);
}

/** Finds by slug. Takes the slug, returns the listing or null. */
export function findBySlug(slug: string): Promise<Listing | null> {
  return selectListingBySlug(slug);
}

/** Inserts a new row. Takes the entity without an id, returns the saved row or slug taken. */
export async function insertListing(listing: NewListing): Promise<Result<Listing, "slug-taken">> {
  const rows = await db
    .insert(listings)
    .values(listing)
    .onConflictDoNothing({ target: listings.slug })
    .returning();
  const row = rows[0];
  if (row === undefined) {
    return err("slug-taken");
  }
  return ok(toListing(row));
}

/** Saves changes to an existing row. Takes the entity, returns the saved row. */
export async function saveListing(listing: Listing): Promise<Listing> {
  const rows = await db
    .update(listings)
    .set({
      title: listing.title,
      description: listing.description,
      platform: listing.platform,
      priceAmount: listing.priceAmount,
      currency: listing.currency,
      followerCount: listing.followerCount,
      accountAgeMonths: listing.accountAgeMonths,
      status: listing.status,
      claimedByUserId: listing.claimedByUserId,
      claimToken: listing.claimToken,
      pendingSince: listing.pendingSince,
      soldAt: listing.soldAt,
      deletedAt: listing.deletedAt,
      updatedAt: listing.updatedAt,
    })
    .where(eq(listings.id, listing.id))
    .returning();
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`Listing ${listing.id} vanished during save.`);
  }
  return toListing(row);
}

/** Removes the row for good. Takes the id, returns nothing. Image rows cascade. */
export async function removeById(id: number): Promise<void> {
  await db.delete(listings).where(eq(listings.id, id));
}

/** Every column a sort order can read. Takes nothing, used as the key column type. */
type SortColumn = AnyColumn;

/** The column a sort order reads. Takes the sort, returns that column. */
function sortColumnFor(sort: AvailableSort): SortColumn {
  switch (sort) {
    case "newest":
      return listings.createdAt;
    case "price":
      return listings.priceAmount;
    case "followers":
      return listings.followerCount;
    case "age":
      return listings.accountAgeMonths;
  }
}

/** Lists visible cards. Takes the query, returns at most limit rows in sort order. */
export async function listAvailableCards(query: AvailableListingsQuery): Promise<readonly ListingCardRow[]> {
  const cover = alias(listingImages, "cover_image");
  const keyColumn = sortColumnFor(query.sort);
  const goingDown = query.direction === "desc";

  const visibility = or(
    eq(listings.status, "available"),
    and(eq(listings.status, "sold"), gte(listings.soldAt, query.soldCutoff)),
  );
  const conditions = [isNull(listings.deletedAt), visibility];

  if (query.platforms.length > 0) {
    conditions.push(inArray(listings.platform, [...query.platforms]));
  }
  if (query.maxPrice !== null) {
    conditions.push(lte(listings.priceAmount, query.maxPrice));
  }
  if (query.minFollowers !== null) {
    conditions.push(gte(listings.followerCount, query.minFollowers));
  }
  if (query.cursor !== null) {
    const key = query.cursor.sortKey;
    const id = query.cursor.id;
    const past = goingDown ? lt(keyColumn, key) : gt(keyColumn, key);
    const pastTie = goingDown
      ? and(eq(keyColumn, key), lt(listings.id, id))
      : and(eq(keyColumn, key), gt(listings.id, id));
    conditions.push(or(past, pastTie));
  }

  const rows = await db
    .select({ listing: listings, coverImageUrl: cover.url })
    .from(listings)
    .leftJoin(
      cover,
      and(
        eq(cover.listingId, listings.id),
        eq(cover.position, COVER_POSITION),
        eq(cover.width, COVER_WIDTH),
      ),
    )
    .where(and(...conditions))
    .orderBy(goingDown ? desc(keyColumn) : asc(keyColumn), goingDown ? desc(listings.id) : asc(listings.id))
    .limit(query.limit);

  return rows.map((row) => ({ listing: toListing(row.listing), coverImageUrl: row.coverImageUrl }));
}

/** Tells whether a buyer already holds a pending listing. Takes the buyer id, returns the answer. */
export async function hasPendingClaimFor(buyerId: string): Promise<boolean> {
  const rows = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.claimedByUserId, buyerId), eq(listings.status, "pending"), isNull(listings.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Lists every listing for the panel, soft deleted included, newest first.
 * Left joins the buyer holding a pending claim and counts the screenshot
 * rows, so the panel never needs a second query per row.
 */
export async function listAllForAdmin(query: AdminListingsQuery): Promise<readonly AdminListingRow[]> {
  const holder = alias(users, "claim_holder");
  const cursor = query.cursor;
  const where =
    cursor === null || !(cursor.sortKey instanceof Date)
      ? undefined
      : or(
          lt(listings.createdAt, cursor.sortKey),
          and(eq(listings.createdAt, cursor.sortKey), lt(listings.id, cursor.id)),
        );

  const rows = await db
    .select({
      listing: listings,
      holderId: holder.id,
      holderDisplayName: holder.displayName,
      holderEmail: holder.email,
      imageCount: sql<number>`count(${listingImages.id})`,
    })
    .from(listings)
    .leftJoin(holder, eq(holder.id, listings.claimedByUserId))
    .leftJoin(listingImages, eq(listingImages.listingId, listings.id))
    .where(where)
    .groupBy(listings.id, holder.id, holder.displayName, holder.email)
    .orderBy(desc(listings.createdAt), desc(listings.id))
    .limit(query.limit);

  return rows.map((row) => ({
    listing: toListing(row.listing),
    holder:
      row.holderId === null || row.holderEmail === null
        ? null
        : { userId: row.holderId, displayName: row.holderDisplayName, email: row.holderEmail },
    imageCount: Number(row.imageCount ?? 0),
  }));
}

/** The listing write port, assembled from the functions above. */
export const listingRepository: ListingRepository = {
  findById,
  findBySlug,
  insertListing,
  saveListing,
  removeById,
};

/** The listing read port, assembled from the functions above. */
export const listingQuery: ListingQuery = {
  listAvailableCards,
  hasPendingClaimFor,
};

/** The admin listing read port, assembled from the functions above. */
export const adminListingQuery: AdminListingQuery = {
  listAllForAdmin,
};

