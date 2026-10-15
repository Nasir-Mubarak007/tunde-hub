/**
 * The storefront table of contents, so keyboard users can skip the header.
 * Rendered on every public page as the first focusable element.
 */
export function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to content
    </a>
  );
}
