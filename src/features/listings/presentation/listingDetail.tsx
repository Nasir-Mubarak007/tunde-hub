/**
 * The detail page. Reads the gated detail, shows the gallery, the facts and
 * the claim panel for a signed in buyer, and a sign in prompt with no full
 * detail for an anonymous visitor. The claim outcome in the url becomes the
 * words the buyer needs.
 */
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { SessionViewer } from "@/features/auth/infrastructure/sessionViewer";
import { getListingDetail } from "../infrastructure/container";
import { sellerWhatsAppNumber } from "../infrastructure/sellerWhatsAppNumber";
import { buildClaimMessage, buildWhatsAppChatUrl } from "../domain/claimMessage";
import { PLATFORM_LABELS } from "./storefrontQuery";
import type { Platform } from "../domain/platform";
import type { ListingDetailDto } from "../application/listingDto";
import type { ClaimPanelKind } from "./components/claimPanel";
import { ClaimPanel } from "./components/claimPanel";
import { ListingGallery } from "./components/listingGallery";
import { SignInPrompt } from "./components/signInPrompt";
import { StorefrontHeader } from "./components/storefrontHeader";

/** Reads the claim outcome out of the url. Takes the raw value, returns the panel kind or null. */
function panelKindFromClaim(raw: string | undefined, status: string, heldByViewer: boolean): ClaimPanelKind {
  if (status === "sold") {
    return "sold";
  }
  switch (raw) {
    case undefined:
      return heldByViewer ? "held" : "claim";
    case "claimed":
      return heldByViewer ? "held" : "claim";
    case "listing-taken":
    case "listing-deleted":
      return "taken";
    case "rate-limited":
      return "rate-limited";
    case "already-has-pending-claim":
      return "pending-cap";
    case "anonymous-cannot-claim":
    case "owner-cannot-claim":
    case "listing-not-found":
      return "refused";
    default:
      return heldByViewer ? "held" : "claim";
  }
}

/** Shows a follower count raw, never compacted. Takes the count, returns the text. */
function formatFollowers(count: number): string {
  return `${count.toLocaleString("en-NG")} followers`;
}

/** Builds the chat link for a buyer who holds the listing. Takes the buyer plus the detail, returns the url. */
function chatUrlFor(viewer: SessionViewer, detail: ListingDetailDto): string {
  const message = buildClaimMessage({
    displayName: viewer.displayName ?? viewer.email,
    title: detail.title,
    slug: detail.slug,
    price: detail.priceDisplay,
  });
  return buildWhatsAppChatUrl(sellerWhatsAppNumber(), message);
}

/** Renders the detail page. Takes the viewer plus the slug plus the claim outcome, returns the page body. */
export async function ListingDetail({
  viewer,
  slug,
  claim,
}: {
  readonly viewer: SessionViewer | null;
  readonly slug: string;
  readonly claim: string | undefined;
}) {
  await connection();
  const now = new Date();
  const found = await getListingDetail(
    { slug, viewer: viewer === null ? null : { userId: viewer.userId, role: viewer.role } },
    now,
  );
  if (!found.ok) {
    notFound();
  }
  const result = found.value;
  const label = PLATFORM_LABELS[result.platform as Platform] ?? result.platform;
  const sold = result.status === "sold";

  return (
    <>
      <StorefrontHeader viewer={viewer} />

      <main id="main" className="shell detail">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">All accounts</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{result.title}</span>
        </nav>

        <div className="detail__grid">
          <div className="detail__media">
            {result.kind === "detail" ? (
              <ListingGallery screenshots={result.images} />
            ) : (
              <div className="gate__cover" aria-hidden="true" />
            )}
          </div>

          <div className="detail__panel">
            <p className="detail__platform">{label}</p>
            <h1 className="detail__title">{result.title}</h1>

            <p className="detail__price">{result.priceDisplay}</p>

            {sold ? (
              <p className="banner-sold" role="status">
                Sold. This account is no longer for sale.
              </p>
            ) : null}

            {result.kind === "preview" ? (
              <SignInPrompt nextPath={`/listings/${result.slug}`} />
            ) : (
              <DetailFacts detail={result} viewer={viewer} claim={claim} label={label} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}

/** The signed in half of the page: the facts, the description and the claim panel. */
function DetailFacts({
  detail,
  viewer,
  claim,
  label,
}: {
  readonly detail: ListingDetailDto;
  readonly viewer: SessionViewer | null;
  readonly claim: string | undefined;
  readonly label: string;
}) {
  const heldByViewer =
    viewer !== null &&
    viewer.role === "customer" &&
    detail.claimedByUserId === viewer.userId &&
    detail.status === "pending";
  const kind = panelKindFromClaim(claim, detail.status, heldByViewer);
  const chatUrl = kind === "held" && viewer !== null ? chatUrlFor(viewer, detail) : null;

  return (
    <>
      <dl className="facts">
        <div className="facts__row">
          <dt>Platform</dt>
          <dd>{label}</dd>
        </div>
        <div className="facts__row">
          <dt>Followers</dt>
          <dd>{formatFollowers(detail.followerCount)}</dd>
        </div>
        <div className="facts__row">
          <dt>Account age</dt>
          <dd>{detail.ageDisplay}</dd>
        </div>
        <div className="facts__row">
          <dt>Price</dt>
          <dd>{detail.priceDisplay}</dd>
        </div>
        <div className="facts__row">
          <dt>Status</dt>
          <dd>{detail.status === "sold" ? "Sold" : "Available"}</dd>
        </div>
      </dl>

      {detail.description === null || detail.description.length === 0 ? null : (
        <div className="description">
          <h2 className="description__title">About this account</h2>
          <p>{detail.description}</p>
        </div>
      )}

      <ClaimPanel
        kind={kind}
        listingId={detail.id}
        chatUrl={chatUrl}
        displayName={viewer?.displayName ?? viewer?.email ?? "there"}
      />
    </>
  );
}
