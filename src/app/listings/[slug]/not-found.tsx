/**
 * The not found body for one listing page.
 * A sale that has passed its window, a listing another buyer holds, and a
 * slug that never existed all land here on purpose: the words never say
 * which, so nothing about a hidden listing leaks. There is always one way
 * back to the shop.
 */
import Link from "next/link";
import { ShopFooter } from "@/features/listings/presentation/components/shopFooter";
import { StorefrontHeader } from "@/features/listings/presentation/components/storefrontHeader";
import { getSessionViewer } from "@/features/auth/infrastructure/sessionViewer";

export default async function ListingNotFound() {
  const viewer = await getSessionViewer();
  return (
    <>
      <StorefrontHeader viewer={viewer} />
      <main id="main" className="shell">
        <div className="empty">
          <p className="empty__title">This account is no longer here</p>
          <p className="empty__text">
            It may have sold, or someone else may have claimed it. Have a look at what is still available.
          </p>
          <Link className="button button--solid" href="/">
            Browse accounts
          </Link>
        </div>
      </main>
      <ShopFooter />
    </>
  );
}
