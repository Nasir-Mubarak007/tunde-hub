/**
 * The shop header: brand on the left, sign in state on the right.
 */
import Link from "next/link";
import { SignOutButton } from "@/features/auth/presentation/signOutButton";
import type { SessionViewer } from "@/features/auth/infrastructure/sessionViewer";

/** Renders the header. Takes the viewer, returns the header element. */
export function StorefrontHeader({ viewer }: { readonly viewer: SessionViewer | null }) {
  return (
    <header className="shop-header">
      <div className="shell shop-header__inner">
        <Link href="/" className="shop-brand">
          <span className="shop-brand__mark" aria-hidden="true">
            TH
          </span>
          <span className="shop-brand__name">TundeHub</span>
        </Link>
        <nav className="shop-header__nav" aria-label="Account">
          {viewer === null ? (
            <Link
              href="/sign-in"
              className="button button--quiet button--small"
            >
              Sign in
            </Link>
          ) : (
            <>
              <span className="shop-header__who">{viewer.displayName ?? viewer.email}</span>
              <SignOutButton />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
