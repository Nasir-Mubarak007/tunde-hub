/**
 * The action panel on a detail page.
 * One button for a buyer who can claim, the plain chat link for a buyer who
 * already holds it, a sold note for a sold listing, and the words for a
 * refusal that came back from the claim action.
 */
import Link from "next/link";
import { claimListingAction } from "../claimListingAction";
import { RATE_LIMIT_MESSAGE } from "../../domain/rateLimit";

/** What the panel should show. Every branch of the page lands in one of these. */
export type ClaimPanelKind = "claim" | "held" | "sold" | "taken" | "rate-limited" | "pending-cap" | "refused";

/** The facts the panel renders. */
export interface ClaimPanelProps {
  readonly kind: ClaimPanelKind;
  readonly listingId: number;
  readonly chatUrl: string | null;
  readonly displayName: string;
}

/** Renders the panel. Takes the props, returns the panel element. */
export function ClaimPanel({ kind, listingId, chatUrl, displayName }: ClaimPanelProps) {
  if (kind === "sold") {
    return (
      <section className="panel panel--notice" aria-live="polite">
        <p className="panel__badge badge badge--sold">Sold</p>
        <h2 className="panel__title">This account has been sold</h2>
        <p className="panel__text">
          It stays on the page for a few days so nobody buys it twice, then it disappears on its own. Other accounts are
          on the grid.
        </p>
        <Link href="/" className="button button--quiet">
          Back to all accounts
        </Link>
      </section>
    );
  }

  if (kind === "taken") {
    return (
      <section className="panel panel--notice" aria-live="assertive">
        <h2 className="panel__title">Just taken</h2>
        <p className="panel__text">
          Another buyer claimed this one a moment ago, so it has left the grid. Nothing was charged to you.
        </p>
        <Link href="/" className="button button--solid">
          Browse other accounts
        </Link>
      </section>
    );
  }

  if (kind === "rate-limited") {
    return (
      <section className="panel panel--notice" aria-live="assertive">
        <h2 className="panel__title">Too many tries this hour</h2>
        <p className="panel__text">{RATE_LIMIT_MESSAGE}</p>
        <Link href="/sign-in" className="button button--quiet">
          Sign in instead
        </Link>
      </section>
    );
  }

  if (kind === "pending-cap") {
    return (
      <section className="panel panel--notice" aria-live="assertive">
        <h2 className="panel__title">You already hold a pending claim</h2>
        <p className="panel__text">
          One buyer holds one account at a time, so this one stays back until the other deal finishes. Finish in WhatsApp,
          then come back for this one.
        </p>
      </section>
    );
  }

  if (kind === "refused") {
    return (
      <section className="panel panel--notice" aria-live="assertive">
        <h2 className="panel__title">This one cannot be claimed</h2>
        <p className="panel__text">
          The owner cannot claim a listing, and a listing that has been removed cannot come back. Have a look at the rest
          of the shop instead.
        </p>
        <Link href="/" className="button button--quiet">
          Back to all accounts
        </Link>
      </section>
    );
  }

  if (kind === "held") {
    return (
      <section className="panel" aria-live="polite">
        <h2 className="panel__title">This one is yours to finish</h2>
        <p className="panel__text">
          {displayName}, you hold this account. Open the chat and the seller has your name, the title and the price
          already written out.
        </p>
        {chatUrl === null ? null : (
          <a href={chatUrl} className="button button--chat button--wide">
            Open WhatsApp chat
          </a>
        )}
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel__title">Buy this account</h2>
      <p className="panel__text">
        One tap holds this account for you and opens a WhatsApp chat with the seller, already written with your name and
        the price.
      </p>
      <form action={claimListingAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <button type="submit" className="button button--chat button--wide">
          Claim and open WhatsApp
        </button>
      </form>
      <p className="panel__fine">Holding an account keeps it off the grid until the sale is done.</p>
    </section>
  );
}
