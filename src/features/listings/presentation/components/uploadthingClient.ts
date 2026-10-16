/**
 * Typed UploadThing React helpers for the listing screenshot route.
 * Type only binds to the listings file router; no runtime import of
 * server code, so the presentation layer stays runtime clean.
 */
import { generateReactHelpers } from "@uploadthing/react";
import type { ListingFileRouter } from "../../infrastructure/uploadthingRouter";

/** The upload hooks bound to the screenshot route. Takes nothing, used by the uploader. */
export const { useUploadThing, uploadFiles } = generateReactHelpers<ListingFileRouter>();
