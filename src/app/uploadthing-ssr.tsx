/**
 * Dynamic boundary for the UploadThing SSR plugin.
 * `extractRouterConfig` reads the clock, which static prerendering under
 * `cacheComponents` rejects, so this component awaits a dynamic data
 * access first and renders at request time. Render it from the owner
 * panel layout (which is dynamic behind the owner gate already), never
 * from the root layout, so the public pages keep prerendering. The
 * uploader works without it by fetching `/api/uploadthing` at runtime;
 * this only skips that fetch.
 */
import { connection } from "next/server";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "./api/uploadthing/core";

/** Renders the SSR plugin. Takes nothing, returns the plugin element. */
export async function UploadthingSsr() {
  await connection();
  return <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />;
}
