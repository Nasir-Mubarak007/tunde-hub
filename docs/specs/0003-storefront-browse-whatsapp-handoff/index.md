# 0003. Storefront browse and WhatsApp handoff

**Date**: 2026-10-14
**Status**: In Progress

## Summary

This spec designs the public shop pages. Visitors browse account cards, filter and sort them, open a detail page, and press one button that claims the account and lands them in the seller WhatsApp chat. Anonymous visitors see cards only. Full detail and the claim button need a signed in buyer.

## Requirements

**User stories**:
- As a visitor, I want to browse account cards without an account, so I can see what is on offer before I sign in.
- As a visitor, I want to filter by platform, price and followers and sort the grid, so I can find an account in my range.
- As a buyer, I want to open a listing and see screenshots plus the full facts, so I can decide before I claim.
- As a buyer, I want one button that claims the account and opens the seller chat, so the deal starts at once.
- As the seller, I want the chat message to name the buyer and the exact account, so I know who wants what.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A visitor sees available listings as cards showing cover image, platform, follower count, age and price, on a phone and on desktop.
- **AC-2**: Filter values for platform, max price and min followers plus the sort choice live in the page URL, and opening a shared link reproduces the same view. Invalid values fall back to defaults, never an error page.
- **AC-3**: A Load more control grows the list with the next cursor page below the grid, and the end of the list says there is nothing more.
- **AC-4**: A signed in buyer opening a listing sees the gallery, price, facts, description, the claim button, and a sold banner when the listing is sold.
- **AC-5**: An anonymous visitor opening a listing sees a sign in prompt and never the full detail.
- **AC-6**: One press by an eligible buyer claims the listing exactly once, even under simultaneous clicks, then lands in the seller WhatsApp chat with a prefilled message naming the buyer display name, title, slug and price.
- **AC-7**: A buyer pressing claim on an already taken listing sees a just taken message with a way back to browsing, and the listing stays hidden from cards.
- **AC-8**: Pending and soft deleted listings never appear in cards or detail to anyone but the owner.
- **AC-9**: A sold listing inside the window shows a sold badge on its card and a sold banner on detail, then drops off on its own.
- **AC-10**: A visitor past the hourly cap sees a wait message with a sign in nudge.
- **AC-11**: A filter combination matching nothing shows a clear empty state with a way to clear the filters.
- **AC-12**: Every public page carries noindex and no sitemap entry.


**Chosen option**: Option 1: Server rendered pages with one combined claim button.

One Next.js slice of server components plus one server action, reading through the data model read use cases and writing through its atomic claim, ending in a chat link built from stored values.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) · `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`)

## Feature design

**Data model sketch**:
No new tables and no migration. Reads run over spec 0002 tables only: `listings` (card fields, status, claim fields, sold and delete timestamps) and `listing_images` (cover plus gallery, position 0 width 768 as the card cover).

**State transitions**:
None new. The button reuses the spec 0002 moves available to pending on claim. Release and confirm stay with the sale lifecycle feature.

**API surface**:
| Route | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/` | GET | platform, maxPrice, minFollowers, sort, direction, cursor (query) | card grid | public | invalid values coerce to defaults |
| `/listings/[slug]` | GET | slug (path) | detail, or sign in prompt, or 404 | public with gate | 404 for unknown, pending, soft deleted to non owners |
| claim action | server action | listingId | redirect to chat link | customer | taken, already holds one pending, rate limited, owner and anonymous refused |

**Design direction** (engineer asked for a suggested direction):
Light warm neutral surface with near black text, one green accent reserved for the WhatsApp action, system font stack so nothing downloads over mobile data. Card grid two columns on phones growing to four on desktop, tap targets at least 44px, visible focus on every control, every filter input labelled. Home order: header with sign in state, short intro banner, filter bar, card grid, empty state. Detail order: gallery, price, facts, description, claim button, sold banner when sold.

**Display and copy** (fixed here so the build invents nothing):
- Follower counts show raw, never compacted. Price uses the existing Naira formatter. Platform labels read Instagram, X, TikTok, Facebook, YouTube.
- Filter defaults are newest first with no platform and no bounds. Empty, non numeric or negative values fall back to those defaults.
- The cursor carries the row id plus the active sort key, which is created time for the default sort. Load more links the next cursor and the server renders everything from the top through that page.
- Detail facts are platform, followers, age, price, status, description and the gallery in all three widths with responsive sizes. An empty description renders nothing.
- The sign in prompt carries a next parameter so sign in returns to the same detail page.
- The chat message template is `Hello! I am {displayName} and I would like to buy "{title}" ({slug}) listed at {price}.` Display name always exists for customers.
- The claim action answers with a 303 redirect to the chat link. A double press lands on the one pending rule and shows the chat link again. A failed redirect shows the chat link again as a plain link.
- Taken copy links back to the grid. Wait copy says too many tries plus try again in an hour with the sign in nudge. Sold badge reads Sold. Empty state offers a clear filters way out.
- Public pages carry noindex through a meta robots tag. No sitemap file exists, so nothing more is needed.

**Value sourcing**:
| Action | Value produced or displayed | Source |
|---|---|---|
| home grid | card rows | `listAvailable` use case over `listings` columns, spec 0002 |
| home grid | cover image | `listing_images` position 0 width 768, null when none, neutral placeholder block |
| home grid | price and age text | `Intl.NumberFormat` per spec 0001, months to years and months per spec 0002 |
| home grid | filters, sort, cursor | page URL query params, read on the server per spec 0001 |
| home grid | next page | opaque cursor from sort key plus id, page size 20, spec 0002 |
| detail | full facts plus gallery | `findBySlug` use case, signed in gate per spec 0002 |
| detail | sign in prompt target | `/sign-in` path, built by the owner sign in feature |
| claim action | buyer id and name | Better Auth session, display name in the chat message |
| claim action | claim token | random 32 byte hex at claim time, stored on the row per spec 0002 |
| claim action | chat link | `https://wa.me/` plus `SELLER_WHATSAPP_NUMBER` plus encoded message text |
| claim action | redirect shape | 303 redirect to the chat link, plain link fallback on failure |
| detail | return after sign in | next parameter pointing at the same detail path |
| startup | seller number shape | digits with country code validated at boot, loud failure |
| claim action | message text | template naming buyer display name, title, slug, price amount plus currency |
| claim action | seller number | `SELLER_WHATSAPP_NUMBER` env value, digits with country code, no plus |
| sold display | badge and banner | status sold plus `sold_at` inside the 7 day placeholder window, spec 0002 |
| rate limit | wait message | hourly cap over visitor hash per spec 0002, with sign in nudge |

**Key invariants**:
- Every public read filters soft deleted rows and skips pending rows at all times.
- The claim is the spec 0002 atomic conditional update. Zero rows means taken, and a refused claim still counts toward the rate limit.
- A buyer holds at most one pending claim, enforced by the partial unique index.
- The owner role and anonymous visitors can never claim.
- Invalid filter and sort values coerce to defaults. No URL ever renders an error page for a bad filter.
- The seller number never appears in page text or logs beyond the chat link itself.

**Security model**:
Cards are public. Full detail needs a signed in buyer. Pending, soft deleted and unknown slugs read as 404 to everyone but the owner. The claim action requires a customer session and rate limits by visitor hash. Password handling stays inside Better Auth. Public pages carry noindex with no sitemap. No payment data exists anywhere in this slice.

**Configuration required**:
- `SELLER_WHATSAPP_NUMBER`: digits with country code and no plus, used only to build the chat link. Blank placeholder in `.env.example`, real value in Vercel only.

**Critical test scenarios**:
- Happy path: a visitor filters the grid, opens a card, signs in, presses claim, lands in chat with the named message, verifies **AC-1**, **AC-2**, **AC-4**, **AC-6**
- Failure case: two buyers press claim on one listing at once, exactly one chat handoff succeeds and the other sees just taken, verifies **AC-6**, **AC-7**
- Failure case: a filter matching nothing shows the empty state with a clear filters way out, verifies **AC-11**
- Auth and permission: anonymous detail shows the prompt only, owner claim refused, over cap claim shows wait plus nudge, verifies **AC-5**, **AC-10**
- Edge case: sold inside the window shows badge plus banner, sold past it is gone from cards, verifies **AC-9**

## Build plan

Ordered thinnest usable whole first, then growth. The shop that ends in chat comes before the browsing comforts.

1. [x] Home grid plus detail shell reading live, with header, intro banner, sign in prompt, empty state and noindex, satisfies **AC-1**, **AC-5**, **AC-8**, **AC-11**, **AC-12**
2. [x] Claim plus chat action with the atomic write, message template, redirect, taken and rate limited states and claim logging, satisfies **AC-6**, **AC-7**, **AC-10**
3. [x] URL filters, sort and link based Load more over the cursor pages, satisfies **AC-2**, **AC-3**
4. [x] Sold badge and banner plus keyboard, focus and contrast pass, satisfies **AC-4**, **AC-9**

Every task maps to at least one acceptance criterion, and every acceptance criterion maps to at least one task.

## Consequences

**Positive**:
- One tap from card to chat with the buyer and account named, no typing needed on a phone.
- Every view is a link, so sharing, back button and reload all behave.
- No client fetching code and no new services, the slice runs on the decided stack.

**Negative / tradeoffs**:
- The claim path must land inside this slice, so it cannot ship before the data model claim milestone does.
- Load more renders a full page per step rather than appending instantly.
- The sign in prompt points at a page this spec does not build, so the slice depends on the owner sign in feature for anonymous conversion.
- An accidental press holds the listing until the later release feature frees it, since pending never frees itself.
- The hourly cap keys on the visitor address, so buyers sharing one mobile network address share one cap.

**Neutral**:
- Page size 20 and cover width 768 are fixed here and can change without a migration.
- A failed chat redirect after a successful claim leaves a held listing whose buyer must retry the link, so the button must offer the link again on failure.

## Follow-up

- [ ] Buyer sign up and sign in pages are owned by the owner sign in feature. This spec only points its prompt at `/sign-in`.
- [ ] The sold window duration, release and confirm moves are owned by the sale lifecycle feature. This spec uses the 7 day placeholder from spec 0002.
- [ ] `SELLER_WHATSAPP_NUMBER` joins `.env.example` and Vercel with no committed value.
- [ ] If a full design system lands later, these pages adopt its tokens in place of the direction recorded here.
