/**
 * The add listing page.
 * Owner only wrapper around the shared listing form in create mode.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { StorefrontHeader } from "@/features/listings/presentation/components/storefrontHeader";
import { ShopFooter } from "@/features/listings/presentation/components/shopFooter";
import { ListingForm } from "@/features/listings/presentation/listingForm";
import { requireOwnerViewer } from "@/features/auth/presentation/ownerGuard";

export const metadata: Metadata = {
  title: "Add a listing | TundeHub",
  description: "Add one listing to your shop.",
  robots: { index: false, follow: false },
};

/**
 * This page reads the owner session on every request, so it is allowed to
 * block instead of prerendering instantly.
 */
export const instant = false;

/** Renders the page. Takes nothing, returns the page body. */
export default async function NewListingPage() {
  const viewer = await requireOwnerViewer("/admin/listings/new");
  return (
    <>
      <StorefrontHeader viewer={viewer} />
      <main id="main" className="shell detail" style={{ background: "var(--owner-surface)" }}>
        <p className="crumbs">
          <Link href="/admin">Owner panel</Link>
          <span aria-hidden="true"> / </span>
          <span>Add a listing</span>
        </p>
        <div className="detail__panel">
          <p className="detail__platform">Private</p>
          <h1 className="detail__title">Add a listing</h1>
          <p className="panel__text">Photos upload first, then the form saves everything in one go.</p>
          <ListingForm mode="create" />
        </div>
      </main>
      <ShopFooter />
    </>
  );
}
