/**
 * The home grid. Reads live through the read use case, renders the header,
 * the intro banner, the filter bar, the card grid and the paging links.
 */
import Link from "next/link";
import { connection } from "next/server";
import type { SessionViewer } from "@/features/auth/infrastructure/sessionViewer";
import { listCardsThroughCursor, listStorefrontCards } from "../infrastructure/container";
import type { StorefrontFilters } from "./storefrontQuery";
import {
  buildStorefrontHref,
  hasNarrowing,
  parseStorefrontFilters,
  toListAvailableInput,
} from "./storefrontQuery";
import type { SearchValues } from "./storefrontQuery";
import type { ListingCardDto } from "../application/listingDto";
import { EmptyState } from "./components/emptyState";
import { FilterBar } from "./components/filterBar";
import { ListingCard } from "./components/listingCard";
import { ShopFooter } from "./components/shopFooter";
import { StorefrontHeader } from "./components/storefrontHeader";

/** Reads the grid and renders it. Takes the viewer plus the query values, returns the page body. */
export async function StorefrontHome({
  viewer,
  searchValues,
}: {
  readonly viewer: SessionViewer | null;
  readonly searchValues: SearchValues;
}) {
  await connection();
  const filters: StorefrontFilters = parseStorefrontFilters(searchValues);
  const input = toListAvailableInput(filters);
  const now = new Date();

  let cards: readonly ListingCardDto[];
  let nextCursor: string | null = null;

  if (filters.cursor.length > 0) {
    const through = await listCardsThroughCursor(input, filters.cursor, now);
    cards = through.items;
    nextCursor = through.nextCursor;
  } else {
    const page = await listStorefrontCards(input, now);
    cards = page.ok ? page.value.items : [];
    nextCursor = page.ok ? page.value.nextCursor : null;
  }

  const clearHref = "/";
  const countLabel = cards.length === 1 ? "1 account" : `${cards.length} accounts`;

  return (
    <>
      <StorefrontHeader viewer={viewer} />

      <main id="main" className="shell">
        <section className="banner">
          <div className="banner__text">
            <h1 className="banner__title">Social accounts, ready to hand over</h1>
            <p className="banner__lead">
              Every account here is verified by hand, priced in Naira, and yours the moment the chat says yes. One tap
              holds it, the rest happens on WhatsApp.
            </p>
            <ul className="banner__points">
              <li>Instant handover, no waiting room</li>
              <li>Screenshots of the real profile</li>
              <li>Deal finished in WhatsApp</li>
            </ul>
          </div>
        </section>

        <FilterBar filters={filters} />

        <div className="grid-head">
          <h2 className="grid-head__title">{hasNarrowing(filters) ? "Matching accounts" : "Available now"}</h2>
          <p className="grid-head__count">{countLabel}</p>
        </div>

        {cards.length === 0 ? (
          <EmptyState clearHref={clearHref} />
        ) : (
          <>
            <ul className="grid">
              {cards.map((card) => (
                <li key={card.id}>
                  <ListingCard card={card} />
                </li>
              ))}
            </ul>

            <div className="paging">
              {nextCursor === null ? (
                <p className="paging__end">That is every account on sale right now.</p>
              ) : (
                <Link
                  href={buildStorefrontHref(filters, { cursor: nextCursor })}
                  className="button button--quiet button--wide"
                >
                  Load more accounts
                </Link>
              )}
            </div>
          </>
        )}
      </main>

      <ShopFooter />
    </>
  );
}
