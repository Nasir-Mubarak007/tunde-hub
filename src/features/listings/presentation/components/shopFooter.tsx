/**
 * The shop footer, shared by the public pages and the sign in screen.
 */
import type { ReactNode } from "react";

/** Renders the footer. Takes no props, returns the footer element. */
export function ShopFooter(): ReactNode {
  return (
    <footer className="shop-footer">
      <div className="shell shop-footer__inner">
        <p>TundeHub. Accounts are sold as they are and deals are finished in WhatsApp.</p>
        <p className="shop-footer__fine">No payments are taken on this site.</p>
      </div>
    </footer>
  );
}
