/**
 * The screenshot gallery on a detail page.
 * Each screenshot carries its three width variants, so the phone downloads
 * the small one and the desktop the large one.
 */
import Image from "next/image";
import type { ListingScreenshotDto } from "../../application/listingDto";

/** Renders the gallery. Takes the screenshots, returns the gallery element or null. */
export function ListingGallery({ screenshots }: { readonly screenshots: readonly ListingScreenshotDto[] }) {
  const withImages = screenshots.filter((screenshot) => screenshot.variants.length > 0);
  if (withImages.length === 0) {
    return null;
  }
  const [first, ...rest] = withImages;
  // The optimizer builds the srcset from this source, so the hand made
  // srcset is no longer needed. Height is not stored per variant, so the
  // 768 hint below only reserves the layout box, matching the old markup.
  const lead = first.variants[1] ?? first.variants[0];
  return (
    <div className="gallery">
      <Image
        className="gallery__lead"
        src={lead.url}
        alt="Account screenshot"
        width={lead.width}
        height={768}
        sizes="(min-width: 900px) 60vw, 100vw"
        priority
      />
      {rest.length === 0 ? null : (
        <div className="gallery__strip">
          {rest.map((screenshot) => (
            <Image
              key={screenshot.position}
              className="gallery__thumb"
              src={(screenshot.variants[0] ?? screenshot.variants[1]).url}
              alt={`Account screenshot ${screenshot.position + 1}`}
              width={320}
              height={320}
              sizes="(min-width: 900px) 20vw, 33vw"
            />
          ))}
        </div>
      )}
    </div>
  );
}
