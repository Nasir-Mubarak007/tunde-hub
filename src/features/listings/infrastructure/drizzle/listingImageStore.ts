/**
 * Drizzle implementation of the screenshot store.
 * One row per screenshot width, ordered by position then width.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/db";
import type { ListingImage } from "../../domain/listingImage";
import type { ListingImageRow, ListingImageStore } from "../../domain/repositories";
import { listingImages } from "./schema";
import { toListingImage } from "./listingMapper";

/** Lists variants for a listing. Takes the listing id, returns the rows. */
export async function listForListing(listingId: number): Promise<readonly ListingImage[]> {
  const rows = await db
    .select()
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId))
    .orderBy(asc(listingImages.position), asc(listingImages.width));
  return rows.map(toListingImage);
}

/** Replaces every variant for a listing. Takes the id plus the new rows, returns nothing. */
export async function replaceForListing(listingId: number, images: readonly ListingImageRow[]): Promise<void> {
  await db.delete(listingImages).where(eq(listingImages.listingId, listingId));
  if (images.length === 0) {
    return;
  }
  await db.insert(listingImages).values(
    images.map((image) => ({
      listingId,
      position: image.position,
      width: image.width,
      url: image.url,
      fileKey: image.fileKey,
    })),
  );
}

/** Removes every variant for a listing. Takes the id, returns nothing. */
export async function removeForListing(listingId: number): Promise<void> {
  await db.delete(listingImages).where(eq(listingImages.listingId, listingId));
}

/** The screenshot port, assembled from the functions above. */
export const listingImageStore: ListingImageStore = {
  listForListing,
  replaceForListing,
  removeForListing,
};
