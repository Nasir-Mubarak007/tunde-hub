/**
 * The screenshot gallery on a detail page.
 * Each screenshot carries its three width variants, so the phone downloads
 * the small one and the desktop the large one.
 */
import type { ListingScreenshotDto } from "../../application/listingDto";

/** The srcset for one screenshot. Takes the variants, returns the attribute text. */
function srcSetFor(screenshot: ListingScreenshotDto): string {
  return screenshot.variants.map((variant) => `${variant.url} ${variant.width}w`).join(", ");
}

/** Renders the gallery. Takes the screenshots, returns the gallery element or null. */
export function ListingGallery({ screenshots }: { readonly screenshots: readonly ListingScreenshotDto[] }) {
  const withImages = screenshots.filter((screenshot) => screenshot.variants.length > 0);
  if (withImages.length === 0) {
    return null;
  }
  const [first, ...rest] = withImages;
  return (
    <div className="gallery">
      <img
        className="gallery__lead"
        src={(first.variants[1] ?? first.variants[0]).url}
        srcSet={srcSetFor(first)}
        sizes="(min-width: 900px) 60vw, 100vw"
        alt="Account screenshot"
        width={(first.variants[0] ?? first.variants[1]).width}
        height={768}
        loading="eager"
        decoding="async"
      />
      {rest.length === 0 ? null : (
        <div className="gallery__strip">
          {rest.map((screenshot) => (
            <img
              key={screenshot.position}
              className="gallery__thumb"
              src={(screenshot.variants[0] ?? screenshot.variants[1]).url}
              srcSet={srcSetFor(screenshot)}
              sizes="(min-width: 900px) 20vw, 33vw"
              alt={`Account screenshot ${screenshot.position + 1}`}
              width={320}
              height={320}
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}
    </div>
  );
}
