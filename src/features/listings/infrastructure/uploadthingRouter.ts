/**
 * UploadThing file router for listing screenshots.
 * Owner only: the middleware reads the Better Auth session off the
 * request headers and refuses anyone without the owner role.
 * One route, image only, at most 18 files per call (6 screenshots
 * times the 320, 768 and 1200 width variants from spec 0001).
 */
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/features/auth/infrastructure/auth";

const f = createUploadthing();

/** Reads the signed in user off the upload request. Takes the request, returns the user or null. */
async function viewerFromRequest(req: Request): Promise<{ id: string; role?: unknown } | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (session === null) {
    return null;
  }
  const user = session.user as { readonly id: string; readonly role?: unknown };
  return { id: user.id, role: user.role };
}

/** The app file router. Takes nothing, holds the one screenshot route. */
export const listingFileRouter = {
  listingScreenshot: f({
    image: { maxFileSize: "4MB", maxFileCount: 18 },
  })
    .middleware(async ({ req }) => {
      const viewer = await viewerFromRequest(req);
      if (viewer === null || viewer.role !== "owner") {
        throw new UploadThingError("Unauthorized");
      }
      return { userId: viewer.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Screenshot upload complete.", {
        uploadedBy: metadata.userId,
        key: file.key,
      });
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

/** The router type the client helpers bind to. Takes nothing, used as a type only. */
export type ListingFileRouter = typeof listingFileRouter;
