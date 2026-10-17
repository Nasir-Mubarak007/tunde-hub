import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { SkipLink } from "@/features/listings/presentation/components/skipLink";
import "./globals.css";

const display = Inter({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Account Storefront",
  description: "Browse social media accounts for sale and finish the deal on WhatsApp.",
};

const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);var t=m?m[1]:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark'){document.documentElement.classList.add('dark');}document.documentElement.style.colorScheme=t;}catch(e){}})();`;

/**
 * Root layout. A blocking script paints the theme class before paint, so
 * there is no flash and the route still prerenders. Takes the children,
 * returns the html shell.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={display.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
