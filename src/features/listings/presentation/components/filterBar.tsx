/**
 * The filter bar. A plain GET form, so the filters land in the url and the
 * view can be shared. Every control is labelled and reachable by keyboard.
 */
import { buildStorefrontHref, platformOptions, SORT_KEYS } from "../storefrontQuery";
import type { StorefrontFilters } from "../storefrontQuery";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";

/** Renders the bar. Takes the current filters, returns the form element. */
export function FilterBar({ filters }: { readonly filters: StorefrontFilters }) {
  return (
    <form className="filters" method="get" action="/" aria-label="Filter listings">
      <div className="filters__grid">
        <Field label="Platform" htmlFor="filter-platform">
          <select className="field__control" id="filter-platform" name="platform" defaultValue={filters.platform}>
            <option value="">All platforms</option>
            {platformOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Max price" htmlFor="filter-max-price">
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
        </Field>

        <Field label="Min followers" htmlFor="filter-min-followers">
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
        </Field>

        <Field label="Sort" htmlFor="filter-sort">
          <select className="field__control" id="filter-sort" name="sort" defaultValue={filters.sort.length === 0 ? "newest" : filters.sort}>
            {SORT_KEYS.map((key) => (
              <option key={key.value} value={key.value}>
                {key.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Order" htmlFor="filter-direction">
          <select
            className="field__control"
            id="filter-direction"
            name="direction"
            defaultValue={filters.direction.length === 0 ? "desc" : filters.direction}
          >
            <option value="desc">High to low</option>
            <option value="asc">Low to high</option>
          </select>
        </Field>
      </div>

      <div className="filters__actions">
        <Button type="submit" variant="solid">
          Apply filters
        </Button>
        <Button
          variant="quiet"
          href={buildStorefrontHref(filters, { platform: "", maxPrice: "", minFollowers: "", sort: "", direction: "", cursor: "" })}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}
