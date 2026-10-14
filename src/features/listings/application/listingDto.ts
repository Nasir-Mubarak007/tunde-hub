/**
 * Plain objects crossing into presentation.
 * No domain entity reaches the presentation layer. Dates travel as ISO strings.
 */
import { formatAccountAge, formatListingPrice } from "../domain/listing";
import type { Listing } from "../domain/listing";
import type { ListingImage } from "../domain/listingImage";

/** One public card. Light by design for phones on slow links. */
export interface ListingCardDto {
  readonly kind: "card";
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly platform: string;
  readonly priceAmount: number;
  readonly currency: string;
  readonly priceDisplay: string;
  readonly followerCount: number;
  readonly accountAgeMonths: number;
  readonly ageDisplay: string;
  readonly status: string;
  readonly soldAt: string | null;
  readonly coverImageUrl: string | null;
}

/**
 * What an anonymous visitor gets on a detail page: enough to name the
 * listing and price it, never the facts, the gallery or the claim button.
 */
export interface ListingPreviewDto {
  readonly kind: "preview";
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly platform: string;
  readonly priceAmount: number;
  readonly currency: string;
  readonly priceDisplay: string;
  readonly status: string;
  readonly soldAt: string | null;
}

/** One width variant of a screenshot. */
export interface ListingImageVariantDto {
  readonly width: number;
  readonly url: string;
}

/** One screenshot with its three width variants. */
export interface ListingScreenshotDto {
  readonly position: number;
  readonly variants: readonly ListingImageVariantDto[];
}

/** Full detail for one listing. Only signed in buyers and the owner see this shape. */
export interface ListingDetailDto {
  readonly kind: "detail";
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly platform: string;
  readonly priceAmount: number;
  readonly currency: string;
  readonly priceDisplay: string;
  readonly followerCount: number;
  readonly accountAgeMonths: number;
  readonly ageDisplay: string;
  readonly status: string;
  readonly claimedByUserId: string | null;
  readonly pendingSince: string | null;
  readonly soldAt: string | null;
  readonly createdAt: string;
  readonly images: readonly ListingScreenshotDto[];
}

/** Maps a row to its card. Takes the listing plus the cover url, returns the card DTO. */
export function toCardDto(listing: Listing, coverImageUrl: string | null): ListingCardDto {
  return {
    kind: "card",
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    platform: listing.platform,
    priceAmount: listing.priceAmount,
    currency: listing.currency,
    priceDisplay: formatListingPrice(listing.priceAmount, listing.currency),
    followerCount: listing.followerCount,
    accountAgeMonths: listing.accountAgeMonths,
    ageDisplay: formatAccountAge(listing.accountAgeMonths),
    status: listing.status,
    soldAt: listing.soldAt === null ? null : listing.soldAt.toISOString(),
    coverImageUrl,
  };
}

/** Groups flat image rows by position. Takes the rows, returns ordered screenshots. */
function groupScreenshots(images: readonly ListingImage[]): readonly ListingScreenshotDto[] {
  const byPosition = new Map<number, ListingImage[]>();
  for (const image of images) {
    const group = byPosition.get(image.position);
    if (group === undefined) {
      byPosition.set(image.position, [image]);
    } else {
      group.push(image);
    }
  }
  return [...byPosition.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([position, rows]) => ({
      position,
      variants: [...rows]
        .sort((left, right) => left.width - right.width)
        .map((row) => ({ width: row.width, url: row.url })),
    }));
}

/** Maps a listing to its public preview. Takes the entity, returns the preview DTO. */
export function toPreviewDto(listing: Listing): ListingPreviewDto {
  return {
    kind: "preview",
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    platform: listing.platform,
    priceAmount: listing.priceAmount,
    currency: listing.currency,
    priceDisplay: formatListingPrice(listing.priceAmount, listing.currency),
    status: listing.status,
    soldAt: listing.soldAt === null ? null : listing.soldAt.toISOString(),
  };
}

/** Maps a listing plus its images to full detail. Takes both, returns the detail DTO. */
export function toDetailDto(listing: Listing, images: readonly ListingImage[]): ListingDetailDto {
  return {
    kind: "detail",
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    platform: listing.platform,
    priceAmount: listing.priceAmount,
    currency: listing.currency,
    priceDisplay: formatListingPrice(listing.priceAmount, listing.currency),
    followerCount: listing.followerCount,
    accountAgeMonths: listing.accountAgeMonths,
    ageDisplay: formatAccountAge(listing.accountAgeMonths),
    status: listing.status,
    claimedByUserId: listing.claimedByUserId,
    pendingSince: listing.pendingSince === null ? null : listing.pendingSince.toISOString(),
    soldAt: listing.soldAt === null ? null : listing.soldAt.toISOString(),
    createdAt: listing.createdAt.toISOString(),
    images: groupScreenshots(images),
  };
}
