/**
 * UploadThing App Router handlers.
 * Serves the screenshot uploads from /api/uploadthing on the Node
 * runtime, since the upload library requires it per spec 0001.
 */
/**
 * UploadThing route handlers for listing screenshot uploads.
 * Served from /api/uploadthing on the default Node runtime.
 */
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

export const { GET, POST } = createRouteHandler({ router: ourFileRouter });
