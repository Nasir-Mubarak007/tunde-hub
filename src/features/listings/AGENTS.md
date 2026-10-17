# Listings

## Overview

The core entity of the shop: an account for sale, its screenshots, the rules that keep two buyers off the same listing, and the moves the owner can make on it. Every storefront page and every admin page reads through this area. Nothing here imports from `auth` except the shared database client, and no layer below `presentation` knows about Next.js, Drizzle, or UploadThing.

## Key files

| File | Owns |
|---|---|
| `domain/listing.ts` | the `Listing` entity, its invariants, price formatting |
| `domain/claim.ts`, `domain/claimMessage.ts` | the one pending claim per buyer rule and its refusal copy |
| `domain/visibility.ts` | who may read, edit, sell, or restore a listing |
| `domain/repositories.ts` | every port the use cases depend on, with the throw contract on each |
| `application/listingWriteInput.ts` | the only place Zod lives in a use case layer |
| `application/saleLifecycle.ts`, `application/claimListing.ts` | the conditional writes that keep the sale honest |
| `infrastructure/container.ts` | the composition root: ports, `now`, and the `...Action` wrappers |
| `infrastructure/drizzle/saleStore.ts` | the four owner moves, one conditional `UPDATE` each |
| `infrastructure/drizzle/listingMapper.ts` | the only place a database row becomes an entity |
| `presentation/adminListingActions.ts` | every admin write, with `revalidatePath` |
| `presentation/adminList.tsx` | the panel table, the row buttons, the bulk bar and the result message |
| `presentation/claimListingAction.ts` | the claim write, which redirects instead of revalidating |
| `presentation/storefrontQuery.ts` | the public URL contract: parse, build, narrow |

## Conventions

- Ports are declared in `domain/repositories.ts`, implemented as free functions in `infrastructure/drizzle/`, then assembled at the bottom of the file as `export const listingRepository: ListingRepository = { ... }`.
- Money is whole units. `priceAmount` is a non negative integer, `currency` is three upper case letters, default `NGN`. Format only through `formatListingPrice`, and let DTOs carry both the raw value and a pre formatted `priceDisplay`.
- A slug is generated once at create time and then frozen. It is absent from `UpdateListingChanges` on purpose, so the edit form cannot move a live URL.
- `now` is always passed in. Only `container.ts` and the server actions call `new Date()`. The one exception is `saleStore`, which stamps `updatedAt` from `sql\`now()\`` so the timestamp is atomic with the state guard.
- Failures are values, never thrown. Error codes are kebab case string literals, exhaustive switches close with `assertNever()`, and validation issue lists are deduplicated and ordered.
- Every owner move is a single conditional write: `UPDATE ... WHERE id = ? AND status = <expected> AND deleted_at IS NULL`. Zero rows updated means someone else moved first, which surfaces as the `just-changed` refusal rather than an error.
- Public visibility is decided in SQL, never in memory: not deleted, and either available or sold inside `SOLD_WINDOW_DAYS`.
- DTO mappers turn `Date` into ISO strings. `AdminListingDto` is the deliberate exception, because the admin page renders dates on the server.

## Gotchas

- `infrastructure/drizzle/schema.ts` re-declares `userRoleEnum` with the same name and members as the auth schema, so `db.schema` can merge both. Changing one without the other breaks the database client.
- Two simultaneous creates of the same title both land: each slug attempt relies on `ON CONFLICT DO NOTHING` on the unique slug, and exhaustion is a normal refusal, not a crash.
- Screenshots go through UploadThing: owners only, images only, 4 MB each, up to 18 files, because there are 6 slots and 3 widths (320, 768, 1200). Resizing happens in the browser before upload.
- `presentation` reaches infrastructure only through `container`, never through a repository file directly.
- `application/adminOverview.ts` is intentionally left out of the barrel.
- The panel's result message and its focus live outside the empty state branch, so a move that drains a bucket still announces and still keeps the keyboard in the panel.
- `aria-disabled` on a panel button means a move is running, never "you cannot press this yet". The empty selection sentence comes from the action, so the panel must not swallow the press before it gets there.
- After a move the browser drops focus to the document, because the pressed button unmounts with the refreshed rows; the effect moves focus to the status region instead.
- The admin query joins the holder for every status. A pending row reads Held by, a sold row reads Sold to.

## Related specs

[0002 data model](../../../docs/specs/0002-data-model/index.md) · [0003 storefront](../../../../docs/specs/0003-storefront-browse-whatsapp-handoff/index.md) · [0005 sale lifecycle](../../../docs/specs/0005-sale-lifecycle/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._