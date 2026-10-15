import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SkipLink } from "@/features/listings/presentation/components/skipLink";
import "./globals.css";

export const metadata: Metadata = {
  title: "Account Storefront",
  description: "Browse social media accounts for sale and finish the deal on WhatsApp.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
