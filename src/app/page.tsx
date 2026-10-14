import type { Metadata } from "next";
import { Suspense } from "react";
import { StorefrontHome } from "@/features/listings/presentation/storefrontHome";
import { StorefrontSkeleton } from "@/features/listings/presentation/components/storefrontSkeleton";
import { getSessionViewer } from "@/features/auth/infrastructure/sessionViewer";

export const metadata: Metadata = {
  title: "Social accounts for sale | TundeHub",
  description: "Browse verified social media accounts, then finish the deal in WhatsApp.",
  robots: { index: false, follow: false },
};

async function HomeGrid({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [viewer, values] = await Promise.all([getSessionViewer(), searchParams]);
  return <StorefrontHome viewer={viewer} searchValues={values} />;
}

export default function Home({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <HomeGrid searchParams={searchParams} />
    </Suspense>
  );
}
