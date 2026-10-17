/**
 * The edit listing page.
 * Owner only wrapper around the shared listing form in edit mode. It loads
 * the stored row plus its screenshots, so the form starts from the truth.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { StorefrontHeader } from "@/features/listings/presentation/components/storefrontHeader";
import { ShopFooter } from "@/features/listings/presentation/components/shopFooter";
import { ListingForm } from "@/features/listings/presentation/listingForm";
import { readListingForEdit } from "@/features/listings/presentation/adminListingActions";

export const metadata: Metadata = {
  title: "Edit a listing | TundeHub",
  description: "Edit one listing in your shop.",
  robots: { index: false, follow: false },
};

/**
 * This page reads the owner session on every request, so it is allowed to
 * block instead of prerendering instantly.
 */
export const instant = false;

/** Reads the numeric id. Takes the raw value, returns the id or null. */
function idFrom(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(id) ? id : null;
}

/** Renders the page. Takes the route params, returns the page body. */
export default async function EditListingPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const route = await params;
  const listingId = idFrom(route.id);
  if (listingId === null) {
    return (
      <main id="main" className="shell detail">
        <div className="panel panel--notice" role="alert">
          <p className="panel__title">That listing link looks off</p>
          <p className="panel__text">
            <Link href="/admin">Back to the panel</Link>
          </p>
        </div>
      </main>
    );
  }
  const { viewer, payload } = await readListingForEdit(listingId);
  if (!payload.ok) {
    return (
      <>
        <StorefrontHeader viewer={viewer} />
        <main id="main" className="shell detail">
          <div className="panel panel--notice" role="alert">
            <p className="panel__title">That listing is gone</p>
            <p className="panel__text">
              <Link href="/admin">Back to the panel</Link>
            </p>
          </div>
        </main>
        <ShopFooter />
      </>
    );
  }
  const { listing, images } = payload.value;
  return (
    <>
      <StorefrontHeader viewer={viewer} />
      <main id="main" className="shell detail" style={{ background: "var(--owner-surface)" }}>
        <p className="crumbs">
          <Link href="/admin">Owner panel</Link>
          <span aria-hidden="true"> / </span>
          <span>Edit {listing.title}</span>
        </p>
        <div className="detail__panel">
          <p className="detail__platform">Private</p>
          <h1 className="detail__title">Edit {listing.title}</h1>
          <p className="panel__text">The link stays the same when the title changes, so shared links keep working.</p>
          <ListingForm
            mode="edit"
            listingId={listing.id}
            initial={{
              title: listing.title,
              platform: listing.platform,
              priceAmount: listing.priceAmount,
              currency: listing.currency,
              followerCount: listing.followerCount,
              accountAgeMonths: listing.accountAgeMonths,
              description: listing.description ?? "",
              images: images.map((image) => ({
                position: image.position,
                width: image.width,
                url: image.url,
                fileKey: image.fileKey ?? "",
              })),
            }}
          />
        </div>
      </main>
      <ShopFooter />
    </>
  );
}
