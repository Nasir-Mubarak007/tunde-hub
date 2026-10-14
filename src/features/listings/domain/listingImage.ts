/**
 * Screenshots for a listing.
 * Each screenshot has a position and three width variants.
 * At most six screenshots per listing, enforced here in pure code.
 * URL shape is checked at the boundary by Zod, here URLs must be non empty.
 */
import type { Result } from "./result";
import { err, ok } from "./result";

/** Width variants produced before upload. Takes nothing, used as the source of the union below. */
export const IMAGE_WIDTHS = [320, 768, 1200] as const;

/** A supported screenshot width. One of 320, 768, 1200. */
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

/** Max screenshots per listing. Each screenshot carries three width rows. */
export const MAX_SCREENSHOTS = 6;

/** Lowest screenshot position. Positions run 0 to 5. */
export const MIN_POSITION = 0;

/** Highest screenshot position. Positions run 0 to 5. */
export const MAX_POSITION = 5;

/** A stored screenshot variant. One row per position and width. */
export interface ListingImage {
  readonly id: number;
  readonly listingId: number;
  readonly position: number;
  readonly width: ImageWidth;
  readonly url: string;
  readonly fileKey: string | null;
  readonly createdAt: Date;
}

/** Plain input for validation, before an id exists. */
export interface ListingImageInput {
  readonly position: number;
  readonly width: number;
  readonly url: string;
}

/** Why a screenshot set is invalid. Returned as a value, never thrown. */
export type ListingImageIssue =
  | "too-many-screenshots"
  | "position-not-integer"
  | "position-out-of-range"
  | "width-not-integer"
  | "width-unsupported"
  | "url-required"
  | "duplicate-variant"
  | "incomplete-width-set";

/** Checks a whole screenshot set. Takes the plain inputs, returns them or the distinct issues. */
export function validateListingImages(
  images: readonly ListingImageInput[],
): Result<readonly ListingImageInput[], readonly ListingImageIssue[]> {
  const issues: ListingImageIssue[] = [];
  const add = (issue: ListingImageIssue): void => {
    if (!issues.includes(issue)) {
      issues.push(issue);
    }
  };

  const positions = new Set<number>();
  const seenVariants = new Set<string>();
  for (const image of images) {
    if (!Number.isInteger(image.position)) {
      add("position-not-integer");
    } else {
      if (image.position < MIN_POSITION || image.position > MAX_POSITION) {
        add("position-out-of-range");
      }
      positions.add(image.position);
    }
    if (!Number.isInteger(image.width)) {
      add("width-not-integer");
    } else if (!(IMAGE_WIDTHS as readonly number[]).includes(image.width)) {
      add("width-unsupported");
    }
    if (image.url.trim().length === 0) {
      add("url-required");
    }
    const key = `${image.position}:${image.width}`;
    if (seenVariants.has(key)) {
      add("duplicate-variant");
    }
    seenVariants.add(key);
  }

  if (positions.size > MAX_SCREENSHOTS) {
    add("too-many-screenshots");
  }

  for (const position of positions) {
    const widths = new Set<number>();
    for (const image of images) {
      if (image.position === position) {
        widths.add(image.width);
      }
    }
    for (const width of IMAGE_WIDTHS) {
      if (!widths.has(width)) {
        add("incomplete-width-set");
        break;
      }
    }
  }

  if (issues.length > 0) {
    return err(issues);
  }
  return ok(images);
}
