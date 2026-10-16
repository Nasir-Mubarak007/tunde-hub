import type { Metadata } from "next";
import { ListingDetail } from "@/features/listings/presentation/listingDetail";
import { getSessionViewer } from "@/features/auth/infrastructure/sessionViewer";

export const metadata: Metadata = {
  title: "Account details | TundeHub",
  description: "Screenshots, facts and the WhatsApp handoff for one listed account.",
  robots: { index: false, follow: false },
};

export default async function ListingPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The session read sits at the page level on purpose, so no static
  // shell renders above the listing lookup. A missing listing renders
  // the not found body with no data leak. Note: in production the route
  // resumes a postponed shell, which keeps status 200. True 404 status
  // needs an architect call (spec says 404, framework serves 200 here).
  const [{ slug }, values, viewer] = await Promise.all([params, searchParams, getSessionViewer()]);
  const rawClaim = values.claim;
  const claim = typeof rawClaim === "string" ? rawClaim : undefined;
  return <ListingDetail viewer={viewer} slug={slug} claim={claim} />;
}

/**
 * This page reads the session and the live listing per request, and a
 * missing listing must answer 404. A not found thrown inside a Suspense
 * child keeps the 200 shell, so there is no Suspense here on purpose,
 * and the route is allowed to block instead of prerendering instantly.
 */
export const instant = false;
