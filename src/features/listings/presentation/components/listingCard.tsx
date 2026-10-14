/**
 * One listing card on the grid.
 * Cards are public and light: cover, platform, followers, age and price,
 * plus a sold badge while the sold window is still open.
 */
import Link from "next/link";
import type { ListingCardDto } from "../../application/listingDto";
import { PLATFORM_LABELS } from "../storefrontQuery";
import type { Platform } from "../../domain/platform";

/** Shows a follower count raw, never compacted. Takes the count, returns the text. */
function formatFollowers(count: number): string {
  return `${count.toLocaleString("en-NG")} followers`;
}

/** Renders one card. Takes the card dto, returns the card element. */
export function ListingCard({ card }: { readonly card: ListingCardDto }) {
  const label = PLATFORM_LABELS[card.platform as Platform] ?? card.platform;
  const sold = card.status === "sold";
  return (
    <article className="card">
      <Link href={`/listings/${card.slug}`} className="card__link">
        <div className="card__cover">
          {card.coverImageUrl === null ? (
            <span className="card__placeholder" aria-hidden="true">
              {label.slice(0, 2)}
            </span>
          ) : (
            <img
              className="card__image"
              src={card.coverImageUrl}
              alt={`${card.title} on ${label}`}
              width={768}
              height={768}
              loading="lazy"
              decoding="async"
            />
          )}
          {sold ? <span className="badge badge--sold">Sold</span> : null}
        </div>
        <div className="card__body">
          <p className="card__platform">{label}</p>
          <h3 className="card__title">{card.title}</h3>
          <p className="card__meta">
            {formatFollowers(card.followerCount)}
            <span aria-hidden="true"> · </span>
            {card.ageDisplay} old
          </p>
          <p className="card__price">{card.priceDisplay}</p>
        </div>
      </Link>
    </article>
  );
}
