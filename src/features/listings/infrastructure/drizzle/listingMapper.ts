/**
 * Row to entity mapping.
 * The only place a database row becomes a domain entity, so the domain
 * never learns the shape of a table.
 */
import type { Listing } from "../../domain/listing";
import type { ListingImage } from "../../domain/listingImage";
import type { listings, listingImages } from "./schema";

/** A listings table row. Takes nothing, used as the mapper input type. */
export type ListingRow = typeof listings.$inferSelect;

/** A listing_images table row. Takes nothing, used as the mapper input type. */
export type ListingImageRowRecord = typeof listingImages.$inferSelect;

/** Maps one row to its entity. Takes the row, returns the entity. */
export function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    platform: row.platform,
    priceAmount: row.priceAmount,
    currency: row.currency,
    followerCount: row.followerCount,
    accountAgeMonths: row.accountAgeMonths,
    status: row.status,
    claimedByUserId: row.claimedByUserId,
    claimToken: row.claimToken,
    pendingSince: row.pendingSince,
    soldAt: row.soldAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Maps one image row to its entity. Takes the row, returns the entity. */
export function toListingImage(row: ListingImageRowRecord): ListingImage {
  return {
    id: row.id,
    listingId: row.listingId,
    position: row.position,
    width: row.width as ListingImage["width"],
    url: row.url,
    fileKey: row.fileKey,
    createdAt: row.createdAt,
  };
}
