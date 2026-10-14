/**
 * Platforms a listed account can belong to.
 * New platforms arrive later through a small migration.
 */

/** Every supported platform. Takes nothing, used as the source of the union below. */
export const PLATFORMS = ["instagram", "x", "tiktok", "facebook", "youtube"] as const;

/** A supported platform. One of the starter set above. */
export type Platform = (typeof PLATFORMS)[number];

/** Checks a raw string. Takes the candidate, returns true only for a known platform. */
export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

/** The words each platform is shown as, in every layer. Takes nothing, keyed by the stored value. */
export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
};

/** The label for one platform. Takes the stored value, returns its label or the raw value. */
export function platformLabel(platform: string): string {
  return isPlatform(platform) ? PLATFORM_LABELS[platform] : platform;
}
