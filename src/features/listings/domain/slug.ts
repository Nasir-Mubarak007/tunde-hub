/**
 * Slug building for listings.
 * The slug is generated once at create time and frozen after,
 * so shared links never break when a title changes.
 */

/** Builds a link safe slug from a title. Takes the raw title, returns the slug. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** How many suffixed slugs one title may try before the create is refused. */
export const MAX_SLUG_SUFFIX_ATTEMPTS = 100;

/**
 * Builds the nth collision suffix for a slug. Attempt zero is the plain
 * slug, so the first try never carries a suffix. Attempts count up in
 * base 36, keeping slugs short as the shop grows.
 */
export function slugWithSuffix(slug: string, attempt: number): string {
  if (attempt <= 0) {
    return slug;
  }
  return `${slug}-${attempt.toString(36)}`;
}
