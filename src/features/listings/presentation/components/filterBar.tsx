/**
 * The filter bar. A plain GET form, so the filters land in the url and the
 * view can be shared. Every control is labelled and reachable by keyboard.
 */
import Link from "next/link";
import { buildStorefrontHref, platformOptions, SORT_KEYS } from "../storefrontQuery";
import type { StorefrontFilters } from "../storefrontQuery";

/** Renders the bar. Takes the current filters, returns the form element. */
export function FilterBar({ filters }: { readonly filters: StorefrontFilters }) {
  return (
    <form className="filters" method="get" action="/" aria-label="Filter listings">
      <div className="filters__grid">
        <div className="field">
          <label className="field__label" htmlFor="filter-platform">
            Platform
          </label>
          <select className="field__control" id="filter-platform" name="platform" defaultValue={filters.platform}>
            <option value="">All platforms</option>
            {platformOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="filter-max-price">
            Max price
          </label>
          <input
            className="field__control"
            id="filter-max-price"
            name="maxPrice"
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder="Any"
            defaultValue={filters.maxPrice}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="filter-min-followers">
            Min followers
          </label>
          <input
            className="field__control"
            id="filter-min-followers"
            name="minFollowers"
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder="Any"
            defaultValue={filters.minFollowers}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="filter-sort">
            Sort
          </label>
          <select className="field__control" id="filter-sort" name="sort" defaultValue={filters.sort.length === 0 ? "newest" : filters.sort}>
            {SORT_KEYS.map((key) => (
              <option key={key.value} value={key.value}>
                {key.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="filter-direction">
            Order
          </label>
          <select
            className="field__control"
            id="filter-direction"
            name="direction"
            defaultValue={filters.direction.length === 0 ? "desc" : filters.direction}
          >
            <option value="desc">High to low</option>
            <option value="asc">Low to high</option>
          </select>
        </div>
      </div>

      <div className="filters__actions">
        <button type="submit" className="button button--solid">
          Apply filters
        </button>
        <Link href={buildStorefrontHref(filters, { platform: "", maxPrice: "", minFollowers: "", sort: "", direction: "", cursor: "" })} className="button button--quiet">
          Clear
        </Link>
      </div>
    </form>
  );
}
