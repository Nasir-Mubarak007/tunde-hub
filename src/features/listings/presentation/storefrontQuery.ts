/**
 * The storefront URL contract.
 * Filters, sort and the cursor live in the query string, so every view is a
 * shareable link. Invalid values are dropped here and the defaults apply,
 * which is why a hand edited url never renders an error page.
 */
import { PLATFORMS, PLATFORM_LABELS, isPlatform } from "../domain/platform";
import type { ListAvailableInput } from "../application/listAvailable";

/** Raw query string values as Next hands them to a page. */
export type SearchValues = Readonly<Record<string, string | string[] | undefined>>;

/** The filter set a page was asked for, already cleaned. */
export interface StorefrontFilters {
  readonly platform: string;
  readonly maxPrice: string;
  readonly minFollowers: string;
  readonly sort: string;
  readonly direction: string;
  readonly cursor: string;
}

export { PLATFORM_LABELS };

/** One sort key shown in the picker. */
export interface SortKey {
  readonly value: string;
  readonly label: string;
}

/** Every sort key, newest first by default. */
export const SORT_KEYS: readonly SortKey[] = [
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "followers", label: "Followers" },
  { value: "age", label: "Age" },
];

/** Reads one raw value. Takes the bag plus the key, returns the string or null. */
function read(values: SearchValues, key: string): string | null {
  const value = values[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    const trimmed = value[0].trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return null;
}

/** Keeps a whole non negative number only. Takes the raw value, returns it or null. */
function wholeNumberOrNull(raw: string | null): string | null {
  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }
  return raw;
}

/** Cleans the query string into the filter set. Takes the raw bag, returns clean filters. */
export function parseStorefrontFilters(values: SearchValues): StorefrontFilters {
  return {
    platform: isPlatform(read(values, "platform") ?? "") ? (read(values, "platform") as string) : "",
    maxPrice: wholeNumberOrNull(read(values, "maxPrice")) ?? "",
    minFollowers: wholeNumberOrNull(read(values, "minFollowers")) ?? "",
    sort: read(values, "sort") ?? "",
    direction: read(values, "direction") ?? "",
    cursor: read(values, "cursor") ?? "",
  };
}

/** Turns filters into use case input. Takes the filters, returns the boundary input. */
export function toListAvailableInput(filters: StorefrontFilters): ListAvailableInput {
  const platform = isPlatform(filters.platform) ? filters.platform : undefined;
  const maxPrice = wholeNumberOrNull(filters.maxPrice);
  const minFollowers = wholeNumberOrNull(filters.minFollowers);
  const sort = SORT_KEYS.some((key) => key.value === filters.sort) ? filters.sort : undefined;
  const direction = filters.direction === "asc" || filters.direction === "desc" ? filters.direction : undefined;
  return {
    platform,
    maxPrice: maxPrice === null ? undefined : Number.parseInt(maxPrice, 10),
    minFollowers: minFollowers === null ? undefined : Number.parseInt(minFollowers, 10),
    sort,
    direction,
    cursor: filters.cursor.length === 0 ? undefined : filters.cursor,
  };
}

/** Tells whether the visitor narrowed anything. Takes the filters, returns the answer. */
export function hasNarrowing(filters: StorefrontFilters): boolean {
  return (
    filters.platform.length > 0 ||
    filters.maxPrice.length > 0 ||
    filters.minFollowers.length > 0 ||
    filters.sort.length > 0
  );
}

/** Builds a storefront link. Takes the filters plus overrides, returns the path with its query. */
export function buildStorefrontHref(filters: StorefrontFilters, overrides: Partial<StorefrontFilters> = {}): string {
  const merged: StorefrontFilters = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.platform.length > 0) {
    params.set("platform", merged.platform);
  }
  if (merged.maxPrice.length > 0) {
    params.set("maxPrice", merged.maxPrice);
  }
  if (merged.minFollowers.length > 0) {
    params.set("minFollowers", merged.minFollowers);
  }
  if (merged.sort.length > 0) {
    params.set("sort", merged.sort);
  }
  if (merged.direction.length > 0) {
    params.set("direction", merged.direction);
  }
  if (merged.cursor.length > 0) {
    params.set("cursor", merged.cursor);
  }
  const query = params.toString();
  return query.length === 0 ? "/" : `/?${query}`;
}

/** Every platform for the picker. Takes nothing, returns the stored values with their labels. */
export function platformOptions(): readonly { value: string; label: string }[] {
  return PLATFORMS.map((platform) => ({ value: platform, label: PLATFORM_LABELS[platform] }));
}

