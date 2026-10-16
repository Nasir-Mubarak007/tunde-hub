/**
 * The owner panel home.
 * Lists every listing for the owner, newest first, with edit and removal
 * controls. Anonymous visitors go to sign in, signed in customers go home.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { StorefrontHeader } from "@/features/listings/presentation/components/storefrontHeader";
import { ShopFooter } from "@/features/listings/presentation/components/shopFooter";
import { AdminList } from "@/features/listings/presentation/adminList";
import { AdminOverview } from "@/features/listings/presentation/adminOverview";
import { parseAdminStatusFilter } from "@/features/listings/presentation/adminStatusFilter";
import { readAdminList } from "@/features/listings/presentation/adminListingActions";

export const metadata: Metadata = {
  title: "Owner panel | TundeHub",
  description: "Private panel for managing your listings.",
  robots: { index: false, follow: false },
};

/**
 * This page reads the owner session on every request, so it is allowed to
 * block instead of prerendering instantly.
 */
export const instant = false;

/** Renders the panel. Takes the query values, returns the page body. */
export default async function AdminPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const rawCursor = values.cursor;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;
  const status = parseAdminStatusFilter(values.status);
  const { viewer, page, overview } = await readAdminList(cursor, status);
  if (!page.ok || !overview.ok) {
    return (
      <>
        <StorefrontHeader viewer={viewer} />
        <main id="main" className="shell detail">
          <p className="crumbs">
            <Link href="/">Shop</Link>
            <span aria-hidden="true"> / </span>
            <span>Owner panel</span>
          </p>
          <div className="panel panel--notice" role="alert">
            <p className="panel__title">The panel did not load</p>
            <p className="panel__text">Try again. A bad page link shows here too.</p>
          </div>
        </main>
        <ShopFooter />
      </>
    );
  }
  return (
    <>
      <StorefrontHeader viewer={viewer} />
      <main id="main" className="shell detail" style={{ background: "var(--owner-surface)" }}>
        <p className="crumbs">
          <Link href="/">Shop</Link>
          <span aria-hidden="true"> / </span>
          <span>Owner panel</span>
        </p>
        <div className="detail__panel">
          <p className="detail__platform">Private</p>
          <h1 className="detail__title">Your listings</h1>
          <p className="panel__text">Add, edit, delete, restore, or purge for good. Changes show on the shop at once.</p>
          <div className="filters__actions">
            <Link className="button button--solid" href="/admin/listings/new">
              Add a listing
            </Link>
            <Link className="button button--quiet" href="/">
              View shop
            </Link>
          </div>
        </div>
        <div className="panel">
          <AdminOverview counts={overview.value} active={status} />
          <AdminList items={page.value.items} status={status} />
          {page.value.nextCursor === null ? null : (
            <p className="paging">
              <Link
                className="button button--quiet"
                href={
                  status === "all"
                    ? `/admin?cursor=${encodeURIComponent(page.value.nextCursor)}`
                    : `/admin?status=${status}&cursor=${encodeURIComponent(page.value.nextCursor)}`
                }
              >
                Load more
              </Link>
            </p>
          )}
        </div>
      </main>
      <ShopFooter />
    </>
  );
}
