import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingDetail } from "@/features/listings/presentation/listingDetail";
import { StorefrontSkeleton } from "@/features/listings/presentation/components/storefrontSkeleton";
import { getSessionViewer } from "@/features/auth/infrastructure/sessionViewer";

export const metadata: Metadata = {
  title: "Account details | TundeHub",
  description: "Screenshots, facts and the WhatsApp handoff for one listed account.",
  robots: { index: false, follow: false },
};

async function DetailBody({
  params,
  searchParams,
}: {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, values, viewer] = await Promise.all([params, searchParams, getSessionViewer()]);
  const rawClaim = values.claim;
  const claim = typeof rawClaim === "string" ? rawClaim : undefined;
  return <ListingDetail viewer={viewer} slug={slug} claim={claim} />;
}

export default function ListingPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <DetailBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}
