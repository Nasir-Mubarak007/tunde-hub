/**
 * UploadThing route core for the App Router.
 * Re-exports the listings file router so the docs convention
 * (`./core` next to `./route`) holds while the router itself
 * lives in the listings infrastructure layer.
 */
export { listingFileRouter as ourFileRouter } from "@/features/listings/infrastructure/uploadthingRouter";
export type { ListingFileRouter as OurFileRouter } from "@/features/listings/infrastructure/uploadthingRouter";
