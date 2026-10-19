import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["postgres"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.ufs.sh" },
      { protocol: "https", hostname: "utfs.io" },
    ],
  },
};

/**
 * The monitor's build plugin. No auth token is passed on purpose: the build
 * only stamps debug ids and leaves the source maps in place, then
 * `scripts/upload-sourcemaps.mjs` uploads them after a successful build and
 * warns instead of failing when the upload is refused.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: { disable: "disable-upload" },
  widenClientFileUpload: true,
  silent: !process.env.CI,
  release: {
    name: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
  },
});