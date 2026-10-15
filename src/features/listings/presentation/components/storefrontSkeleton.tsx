/**
 * The grid placeholder shown while the live cards load.
 * Same shape as the real grid, so the page does not jump.
 */
export function StorefrontSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading accounts</span>
      <div className="shell">
        <div className="banner banner--placeholder" />
        <div className="filters filters--placeholder" />
        <ul className="grid">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
            <li key={index}>
              <div className="card card--placeholder">
                <div className="card__cover" />
                <div className="card__body">
                  <div className="skeleton skeleton--line" />
                  <div className="skeleton skeleton--title" />
                  <div className="skeleton skeleton--line" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
