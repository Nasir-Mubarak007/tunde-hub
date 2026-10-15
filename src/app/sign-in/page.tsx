/**
 * The sign in screen. One page for both modes: signing in and creating an
 * account, flipping inside the card. A signed in visitor never sees it and
 * goes straight to the return path. The detail page prompt points here with
 * a next value, so sign in lands back on the same listing.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionViewer } from "@/features/auth/infrastructure/sessionViewer";
import { resolveNextPath } from "@/features/auth/presentation/nextPath";
import { SignInForm } from "@/features/auth/presentation/signInForm";
import type { SignInMode } from "@/features/auth/presentation/signInForm";
import { StorefrontHeader } from "@/features/listings/presentation/components/storefrontHeader";
import { ShopFooter } from "@/features/listings/presentation/components/shopFooter";

export const metadata: Metadata = {
  title: "Sign in | TundeHub",
  description: "Sign in or create a buyer account to see full account details and claim a listing.",
  robots: { index: false, follow: false },
};

/** Reads the starting mode. Takes the raw value, returns signup only for an exact match. */
function initialModeFrom(raw: string | string[] | undefined): SignInMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "signup" ? "signup" : "signin";
}

/** Renders the screen. Takes the query values, returns the page body. */
export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const next = resolveNextPath(values.next);
  const viewer = await getSessionViewer();
  if (viewer !== null) {
    redirect(next);
  }

  return (
    <>
      <StorefrontHeader viewer={null} />

      <main id="main" className="shell auth-wrap">
        <div className="auth-side">
          <p className="detail__platform">TundeHub buyer account</p>
          <h1 className="auth-side__title">Sign in to TundeHub</h1>
          <p className="auth-side__lead">
            Cards are public on purpose. Full account details, screenshots and the one tap claim button are for signed
            in buyers.
          </p>
          <ul className="auth-side__points">
            <li>Hand checked accounts, priced in Naira</li>
            <li>One pending claim per buyer, never double sold</li>
            <li>Deals finish in your WhatsApp chat</li>
          </ul>
          <p className="auth-side__fine">The owner signs in here too. The panel opens for the owner role.</p>
        </div>

        <SignInForm next={next} initialMode={initialModeFrom(values.mode)} />
      </main>

      <ShopFooter />
    </>
  );
}
