# 0002. Data model for the account storefront

**Date**: 2026-10-12
**Status**: In Progress

## Summary

This spec fixes how the shop stores its data: the listings you sell, the screenshots each listing carries, the buyers who sign up to view the full account details, and the click counts that stop abuse. It also fixes the one rule that matters, that two buyers can never both take the same account, as a single atomic database write. Building from it means one Postgres schema plus a claim operation that stays correct even when two people click at the same moment, with a buyer sign up gate in front of the full details.

## Requirements

**User stories**:
- As a buyer, I want to browse listing cards without an account, so I can see what is on offer before I sign in.
- As a buyer, I want to sign up and sign in with email and password, so I can see the full details of an account and claim it.
- As the owner, I want every listing I create to be stored once with its platform, price, follower count, age and screenshots, so the panel and the public shop show the same truth.
- As the owner, I want a listing to move through available, pending and sold, so no buyer can ever take a listing another buyer already holds.
- As the owner, I want to see who holds a pending listing, so I can finish the deal in WhatsApp.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A listing can be created with title, platform, price, follower count, age in months, currency and zero or more screenshots, is stored with a unique slug, and starts as available.
- **AC-2**: Public listing cards show only listings that are available, or sold and still within the sold window; never pending and never soft deleted.
- **AC-3**: A listing status moves through available, pending and sold, with `pending_since` and `sold_at` recording each transition.
- **AC-4**: Two claim attempts on the same available listing result in exactly one success; the second attempt changes nothing.
- **AC-5**: A successful claim records the buyer id and a claim token; releasing the claim clears both.
- **AC-6**: Signup and claim attempts are rate limited by a keyed hash of the visitor's address per hour; click rows older than 30 days are removed by the daily job.
- **AC-7**: A soft deleted listing never appears publicly and can be restored; a real removal deletes its image rows and their stored files.
- **AC-8**: At most six screenshots per listing, each with an order and three width variants; price, follower count and age reject negative values at the database.
- **AC-9**: A buyer can self sign up with email, password and display name; a role column distinguishes the one owner from customers and gates the admin panel and the detail page.
- **AC-10**: A listing's full detail page is shown only to a signed in buyer; anonymous visitors see the card and are taken to sign in.
- **AC-11**: A buyer holds at most one pending claim at a time; a new claim is refused while one is open.

## Decision

**Chosen option**: One Postgres schema with a buyer identity layer and an atomic claim rule.

The storefront data lives in one schema managed by Drizzle, shaped as: a `users` table (Better Auth generated, extended with a role and a display name), a `listings` table (one row per listed account, with claim fields on the row), a `listing_images` table (one row per screenshot width), and a `rate_limit_clicks` table (one row per visitor hash per hour). The claim rule is a single conditional `UPDATE` that only fires while the listing is still available, so two simultaneous clicks cannot both succeed, backed by a partial unique index that stops one buyer holding two pending claims at once.

**Implementation skills**: `neon-drizzle` (`neondatabase/ai-rules`, `.agents/skills/neon-drizzle/`) · `neon-postgres` (`neondatabase/agent-skills`, `.agents/skills/neon-postgres/`) · `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`)

## Feature design

**Data model sketch**:

`users` (Better Auth generated, plus two additions)
| column | type | rules |
|---|---|---|
| id | text | Better Auth primary key |
| email | text | Better Auth, unique |
| passwordHash and other fields | as generated | owned by the library |
| role | `user_role` enum | not null, default `customer`; values `owner`, `customer` |
| display_name | text | not null for customers, nullable for the owner |
| created_at | timestamptz | as generated |

The owner creation script inserts the single owner with role `owner`. Buyers self sign up and are role `customer`. The signup form requires a display name for customers; the owner row is created by script and does not need one.

`listings`
| column | type | rules |
|---|---|---|
| id | bigint identity | primary key |
| slug | text | not null, unique, generated from the title at create, frozen after |
| title | text | not null |
| description | text | nullable, optional free text |
| platform | `platform` enum | not null; instagram, x, tiktok, facebook, youtube; extended later by migration |
| price_amount | integer | not null, check `>= 0`, whole number |
| currency | char(3) | not null, default `NGN` |
| follower_count | integer | not null, check `>= 0` |
| account_age_months | integer | not null, check `>= 0`, displayed as years and months |
| status | `listing_status` enum | not null, default `available`; `available`, `pending`, `sold` |
| claimed_by_user_id | text | nullable, FK to `users.id`, cleared on release |
| claim_token | text | nullable, unique random token issued at claim, cleared on release |
| pending_since | timestamptz | nullable, set at claim |
| sold_at | timestamptz | nullable, set when sold |
| deleted_at | timestamptz | nullable, soft delete |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now(), rewritten by the repositories on every change |

Plus one partial unique index: `UNIQUE (claimed_by_user_id) WHERE status = 'pending'`, so the database itself refuses a second pending claim for one buyer. Releasing clears `claimed_by_user_id`, which releases the slot.

`listing_images`
| column | type | rules |
|---|---|---|
| id | bigint identity | primary key |
| listing_id | bigint | not null, FK to `listings.id`, cascade on real delete |
| position | integer | not null, which screenshot, 0 to 5 |
| width | integer | not null, one of 320, 768, 1200 |
| url | text | not null, UploadThing URL |
| file_key | text | nullable, UploadThing key for file cleanup |
| created_at | timestamptz | not null, default now() |
| | | unique (`listing_id`, `position`, `width`) |

`rate_limit_clicks`
| column | type | rules |
|---|---|---|
| id | bigint identity | primary key |
| visitor_hash | text | not null, keyed hash of the visitor address |
| bucket | timestamptz | not null, truncated to the hour |
| count | integer | not null, default 0 |
| created_at | timestamptz | not null, default now() |
| | | unique (`visitor_hash`, `bucket`) |

Relationships: `users` 1 to N `listings` through `claimed_by_user_id`; `listings` 1 to N `listing_images`. No owner column on listings; the deferred staff logins feature adds it when a second person exists.

**State transitions** (supported by the fields; feature 7 owns the orchestration and the sold window duration):
- `available` → `pending`: a signed in customer claims the listing; sets `claimed_by_user_id`, `claim_token`, `pending_since`.
- `pending` → `available`: release; resets the three claim fields.
- `pending` → `sold`: sale confirmed; sets `sold_at`. Releasing clears the claim fields so a resold listing starts clean.

**API surface** (application use cases; features 5 and 6 bind these to server actions):
| Action | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|
| `createListing` | title, platform, priceAmount, currency, followerCount, ageMonths, description, images | listing, slug | owner | invalid values, slug collision |
| `updateListing` | id, changed fields | listing | owner | invalid values, not found |
| `softDeleteListing` | id | id | owner | not found |
| `restoreListing` | id | listing | owner | not found |
| `findBySlug` | slug, viewer | listing detail (full only if signed in) | public or customer | 404 for unknown, pending, soft deleted |
| `listAvailable` | filters, sort, cursor | paginated cards | public | none |
| `listForAdmin` | pagination | all listings incl. deleted | owner | none |
| `purgeListing` | id | id | owner | not found, empty on failed file cleanup |
| `claimListing` | listingId, buyer session | ok or refused reason | customer | already taken, re claim by same buyer, already has a pending claim, rate limited |
| buyer sign up and sign in | email, password, display name | session | none | rate limited, duplicate email |

**Value sourcing**:
| Action | Value produced or displayed | Source |
|---|---|---|
| `createListing` | slug | `slugify` of the title; on collision append a short suffix with a capped retry loop built on `ON CONFLICT DO NOTHING`, and a dedicated error when the suffix space is exhausted |
| `createListing` | status worth `available` | DB default, not an input |
| `createListing` | timestamps | DB default now(); `updated_at` rewritten by the repositories on every change |
| `createListing` | images | client uploads the three width files per screenshot (spec 0001 pipeline); Zod validates url shape, position 0 to 5, three widths per position, at most six screenshots, also on update |
| `listAvailable` | visible card set | DB columns: status = `available` and `deleted_at` null, or status = `sold` and `sold_at` within the window |
| `listAvailable` | sold window | computed as `now()` minus the feature 7 constant in the query; feature 3 tests fix that constant here |
| `listAvailable` | pagination | keyset cursor on `(created_at, id)`, fixed page size; filters over platform, price and followers, sorts over price, followers and age |
| `findBySlug` | full detail allowed | session role from Better Auth |
| `findBySlug` | 404 rule | non owners never see pending, soft deleted or unknown slugs; sold within the window shows a sold state to the public |
| `claimListing` | buyer id | session, written to `claimed_by_user_id` |
| `claimListing` | claim token | random 32 byte token generated at claim time, returned to the buyer, the correlation handle feature 7 uses to confirm or release |
| `claimListing` | pending cap | the partial unique index on `claimed_by_user_id` where `status = pending`, surfaced as "already has a pending claim" |
| `claimListing` | refusal reason | result of the atomic update (zero rows) or the partial unique index |
| `claimListing` | click count | same transaction as the claim write; a refused claim still increments |
| rate limit | visitor hash | keyed hash (HMAC with `HASH_SECRET`) of the forwarded visitor address behind Vercel |
| rate limit | hour bucket | clock truncated to the hour in UTC |
| rate limit | threshold | 5 attempts per hour across signup and claim, by atomic upsert increment on `(visitor_hash, bucket)` |

**Key invariants**:
- Exactly one buyer can hold a listing: the claim is one `UPDATE listings SET status = 'pending', pending_since = now(), claim_token = $, claimed_by_user_id = $ WHERE id = $ AND status = 'available' AND deleted_at IS NULL RETURNING id`. Zero rows returned means the listing is gone or taken. The claim write and its click count write run in one transaction, and a refused claim still increments the count.
- At most one pending claim per buyer: the partial unique index `UNIQUE (claimed_by_user_id) WHERE status = 'pending'` refuses a second row, so no check then write race exists. A buyer re claiming the listing they already hold is refused the same way.
- The owner role never claims; a claim by role `owner` is refused.
- Database checks: non negative `price_amount`, `follower_count`, `account_age_months`; unique `slug`; unique `claim_token`; unique `(visitor_hash, bucket)`; unique `(listing_id, position, width)`; width in (320, 768, 1200).
- At most six screenshots per listing, enforced by Zod on create and update, since a cross row count is not a database constraint the width rows can express.
- `pending_since` and `sold_at` come from the database clock (`now()`), never from the client, and `updated_at` is rewritten on every change.
- Public queries filter `deleted_at` and skip `pending` rows at all times.

**Security model**:
- Roles: `owner` (all listing and panel writes, everything) and `customer` (browse cards, view full detail when signed in, claim, one pending at a time). Anonymous visitors browse cards only.
- Visibility by role: cards are public; the full detail page needs a signed in buyer; pending, soft deleted and unknown slugs are 404 to everyone but the owner; sold within the window shows a sold state to the public.
- No personal data of visitors is stored in the clear: claims name the signed in buyer, and the rate limit stores a keyed hash, never the address.
- Buyer email and password live in the Better Auth flow and tables; password hashes are never stored as plain text (the auth library owns hashing).
- No compliance scope: the site takes no payment and collects no payment data.

**Configuration required**:
- `HASH_SECRET`: the key for the keyed visitor address hash used by rate limiting.

**Critical test scenarios**:
- Happy path: a buyer signs up, signs in, views a full listing detail, claims it, and the listing disappears from public cards, verifies **AC-1**, **AC-5**, **AC-9**, **AC-10**, **AC-2**
- Failure case: two buyers claim the same available listing at the same moment; exactly one succeeds, verifies **AC-4**
- Failure case: a buyer with an open pending claim tries to claim a second listing; the partial unique index refuses it, verifies **AC-11**
- Failure case: a buyer re claims the listing they already hold; refused, verifies **AC-4**, **AC-11**
- Auth and permission: an anonymous visitor and an owner both try to claim; both refused, and the anonymous visitor cannot reach full detail, verifies **AC-9**, **AC-10**
- Edge case: a visitor exceeds five claim or signup attempts in an hour and is blocked, verifies **AC-6**
- Edge case: a soft deleted listing is absent from public cards and returns on restore; a real removal drops image rows, verifies **AC-7**

## Build plan

Ordered by the Skateboard approach: stand up the thinnest usable whole first, then grow. The schema lands first so every later task runs against real tables; the claim rule lands once the entities and reads exist.

1. Create the Drizzle schema for `users` additions, `listings`, `listing_images`, and `rate_limit_clicks`, with the check constraints, unique indexes, the partial unique index for one pending claim, and enums, plus the first migration against the Neon branch, satisfies **AC-1**, **AC-6**, **AC-8**, **AC-11**
2. Write the domain entities (`Listing`, `ListingImage`, `ListingStatus`) owning the invariants and the repositories the use cases call, satisfies **AC-1**, **AC-3**, **AC-8**
3. Implement the public reads `listAvailable` (filters, sort, keyset cursor pagination, visibility rule, sold window constant) and `findBySlug` (full detail behind the signed in gate, 404 rule), satisfies **AC-2**, **AC-10**
4. Implement `createListing`, `updateListing`, `softDeleteListing`, `restoreListing`, and `purgeListing` against the repositories, deleting image rows then the UploadThing files on purge and tolerating a failed file delete by logging it, satisfies **AC-1**, **AC-7**
5. Implement the `claimListing` use case: the atomic conditional update, the partial unique index handling the one pending cap, owner refusal, and the click count write in the same transaction, satisfies **AC-4**, **AC-5**, **AC-11**, **AC-6**
6. Expose buyer sign up and sign in on Better Auth with the role default `customer`, the display name requirement, and the owner creation script upserting by owner email with role `owner`, plus the signup rate limit, satisfies **AC-9**, **AC-6**
7. Implement the admin read `listForAdmin` covering all listings including soft deleted, for the panel, satisfies **AC-7**

Every task maps to at least one acceptance criterion, and every acceptance criterion maps to at least one task.

## Consequences

**Positive**:
- The claim rule that matters, one buyer per listing, is a database atomic write, and the one pending cap is now a database partial unique index, so two server instances cannot both pass either rule.
- Buyers get a real identity the panel can refer to, and the full detail gate keeps the valuable content out of plain browsing.
- The rate limit needs no new service and stores no address in the clear.
- The role column is one field; adding more staff later is a row change, not a schema change.

**Negative / tradeoffs**:
- Buyer accounts add a signup surface, password reset responsibility, and a second audience to the product, which the scope previously kept deferred.
- A pending listing never frees itself; it depends on feature 7's release or confirm, because auto releasing is deferred in scope.
- Purging a listing deletes the image rows first and deletes the stored files best effort, so a failed UploadThing delete leaves an orphaned file that only logging and a manual clean can catch.
- Soft deleted rows stay in the table and every public query must remember to filter them.
- The `claimed_by_user_id` foreign key points at Better Auth's text id, so migrations must agree on that id's shape.
- The rate limit keys on the forwarded visitor address header behind Vercel, which a determined client can vary or fake at this volume.
- Three vendors still sit under the app (Vercel, Neon, UploadThing), now with buyer accounts adding the email and password responsibility.

**Neutral**:
- Better Auth generated tables plus our additions share one migration history, so a Better Auth version bump can touch our migration files.
- The sold window duration is owned by feature 7; until that spec exists, feature 3 tests use a constant.
- The detail gate means the storefront, feature 5, must build the sign in prompt and the sign in page; this spec only supplies the data behind it.

## Follow-up

- [ ] Scope reconciliation: "Buyer accounts and sign up" moved out of deferred; the signup and sign in UI lands in features 5 and 6. Run `/scope` to reflect the pull forwards and the changed detail page behaviour on feature 5.
- [ ] `HASH_SECRET` joins the environment variables from spec 0001 in `.env.example` and Vercel and Neon, with no committed value.
- [ ] The sold window duration, the daily hide job, and the released and confirmed transitions are owned by feature 7; its spec should reference the fields this spec defines.
- [ ] The platform enum is a starter set (instagram, x, tiktok, facebook, youtube); each new platform is a small migration.
- [ ] The owner creation script from spec 0001 must set role `owner` so the owner never looks like a customer, and must upsert by owner email so a re run cannot create a second owner.
- [ ] A pending claim never expires on its own; only feature 7's release or confirm moves it. Auto releasing pending listings is deferred in scope.
- [ ] A failed file delete during a purge leaves an orphaned UploadThing file; consider a daily orphan sweep if it ever shows up in logs.

## Rationale

Reasoning, options, and references: see [rationale.md](rationale.md).