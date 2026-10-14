/**
 * The empty state, shown when a filter combination matches nothing.
 * Always offers a way back to the full grid.
 */
import Link from "next/link";

/** Renders the empty state. Takes the clear href, returns the panel element. */
export function EmptyState({ clearHref }: { readonly clearHref: string }) {
  return (
    <section className="empty" aria-live="polite">
      <p className="empty__mark" aria-hidden="true">
        0
      </p>
      <h2 className="empty__title">No accounts match those filters</h2>
      <p className="empty__text">
        Try a wider price range, a lower follower count, or another platform. New accounts land here every week.
      </p>
      <Link href={clearHref} className="button button--solid">
        Clear filters
      </Link>
    </section>
  );
}
