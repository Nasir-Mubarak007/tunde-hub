/**
 * Panel shapes for the admin listing list.
 * Plain values only: the panel never receives a listing entity or a user
 * row, just the facts the panel prints, with the holder named so the owner
 * can finish the deal in WhatsApp.
 */
import { formatAccountAge, formatListingPrice } from "../domain/listing";
import type { Listing } from "../domain/listing";
import type { ListingStatus } from "../domain/listingStatus";
import { platformLabel } from "../domain/platform";
import type { AdminListingRow, ClaimHolder } from "../domain/repositories";

/** One row as the panel renders it. */
export interface AdminListingDto {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly platformLabel: string;
  readonly priceDisplay: string;
  readonly followerCount: number;
  readonly ageDisplay: string;
  readonly status: ListingStatus;
  readonly isDeleted: boolean;
  readonly imageCount: number;
  readonly createdAt: Date;
  readonly pendingSince: Date | null;
  readonly soldAt: Date | null;
  readonly holder: ClaimHolder | null;
}

/** One page of admin rows plus the cursor for the next page. */
export interface AdminListingPage {
  readonly items: readonly AdminListingDto[];
  readonly nextCursor: AdminListingDto | null;
}

/** Maps one admin row to the panel shape. Takes the row, returns the dto. */
export function toAdminListingDto(row: AdminListingRow): AdminListingDto {
  const listing: Listing = row.listing;
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    platformLabel: platformLabel(listing.platform),
    priceDisplay: formatListingPrice(listing.priceAmount, listing.currency),
    followerCount: listing.followerCount,
    ageDisplay: formatAccountAge(listing.accountAgeMonths),
    status: listing.status,
    isDeleted: listing.deletedAt !== null,
    imageCount: row.imageCount,
    createdAt: listing.createdAt,
    pendingSince: listing.pendingSince,
    soldAt: listing.soldAt,
    holder: row.holder,
  };
}