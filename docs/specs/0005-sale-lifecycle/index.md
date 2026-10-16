# 0005. Sale lifecycle for listings

**Date**: 2026-10-16
**Status**: Proposed

## Summary

This spec covers what happens after a buyer claims an account. A claim hides the listing, you confirm the sale or send it back to available, and sold listings keep a sold state for 7 days then leave the public site on their own. It reuses the existing listing row (one database row per listed account) with no new tables and no migration.

## Requirements

**User stories**:
* As the owner, I want to confirm a pending claim as sold or release it back to available, so each claim ends in a sale or a fresh listing.
* As the owner, I want to mark an available listing sold at once and to reopen a mistaken sale, so deals outside the site stay truthful.
* As a buyer, I want to see that I hold a listing with a way back to chat, so I know my claim is safe.
* As a visitor, I want sold listings to show as sold briefly then vanish, so I never chase a gone account.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
* **AC-1**: A successful claim moves the listing from available to pending, hides it from public cards and detail for everyone except the owner and the holder, and the holder sees a hold banner with a way to continue to chat.
* **AC-2**: The owner can confirm a pending listing to sold, which sets sold at to now and keeps the holder on the row.
* **AC-3**: The owner can release a pending listing to available, which clears the holder, the token and pending since.
* **AC-4**: The owner can mark an available listing direct to sold with no holder, and can reopen a sold listing to available, which clears sold at and the holder.
* **AC-5**: A sold listing inside 7 days of sold at shows a sold badge on cards and a sold banner on detail, then drops from cards and detail on its own and reads as not found with a way back to browse.
* **AC-6**: A stale owner press on a changed listing refuses with a just changed message and reloads the true state, so the first write wins when two presses race.
* **AC-7**: Only the owner role may run confirm, release, direct sold and reopen, and holder identity shows in the panel and in the holder own view only, never on public pages.
* **AC-8**: Pending rows carry Sold and Release, available rows carry Mark sold, sold rows carry Reopen, bulk confirm and bulk release act on many pendings with per row results, and empty pending or sold queues show a clear empty message.
* **AC-9**: Every transition writes a log with listing id, old state, new state and actor id.
* **AC-10**: Two simultaneous claims on one listing still leave exactly one holder through the existing atomic write (one conditional database update that only fires while the row is still available).

## Decision

**Chosen option**: Option 1: Owner actions over the existing row plus expiry by query filter.

Transitions run as small owner actions over the existing listing row, and expiry reads as a sold at window in public queries with no job.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) · `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `neon-postgres` (`neondatabase/agent-skills`, `.agents/skills/neon-postgres/`)

## Feature design

**Data model sketch**:
No new tables and no migration. Reuses the spec 0002 `listings` row only:
* `id` bigint identity, primary key.
* `slug` text, unique, frozen after create.
* `status` enum, values `available`, `pending`, `sold`.
* `claimed_by_user_id` text nullable, foreign key to `users.id`, cleared on release and on reopen.
* `claim_token` text nullable unique, cleared on release and on reopen.
* `pending_since` timestamptz nullable, set at claim from the database clock, cleared on release and on reopen.
* `sold_at` timestamptz nullable, set at confirm and at direct sold from the database clock, cleared on reopen.
* `deleted_at` timestamptz nullable, soft delete stays orthogonal to this loop.
* Holder name is never stored on the row. It joins `users.display_name` by `claimed_by_user_id` at read time.

**State transitions**:
* `available` → `pending`: claim by a signed in customer (spec 0002, unchanged).
* `available` → `sold`: direct sold by the owner, sets `sold_at`, holder stays null.
* `pending` → `sold`: confirm by the owner, sets `sold_at`, keeps the holder plus `pending_since` plus the token.
* `pending` → `available`: release by the owner, clears holder, token and `pending_since`.
* `sold` → `available`: reopen by the owner, clears `sold_at` plus holder, token and `pending_since`.
* Every other move is refused. `sold` → `pending` never happens.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `confirmSoldAction` | server action | listingId:number (req) | id, status `sold` | owner | not owner, not found, wrong state |
| `releaseListingAction` | server action | listingId:number (req) | id, status `available` | owner | not owner, not found, wrong state |
| `markSoldDirectAction` | server action | listingId:number (req) | id, status `sold` | owner | not owner, not found, wrong state |
| `reopenSoldAction` | server action | listingId:number (req) | id, status `available` | owner | not owner, not found, wrong state |
| `bulkConfirmSoldAction` | server action | listingIds:number[] (req, max 50) | per id ok or wrong state or not found, best effort | owner | not owner, empty selection |
| `bulkReleaseAction` | server action | listingIds:number[] (req, max 50) | per id ok or wrong state or not found, best effort | owner | not owner, empty selection |
| `/` cards plus `/listings/[slug]` detail | GET | existing filters plus slug | cards and detail honor the 7 day sold window, holder own hold banner | public with customer gate | not found for pending of others, expired sold, soft deleted |

Each write takes listingId only. The expected state guard runs server side from a fresh read in the same conditional write, so no version input is needed. Bulk takes ids in the given order, folds duplicates, and treats one bad row as its own result that never blocks the rest. Panel queues reuse the current status filter plus sort plus paging. Empty copy reads No pending claims and No recent sales. Buttons disable while running with focus kept.

**Value sourcing** (every value each action produces, computes, or displays names where it comes from):
| Action | Value produced / displayed | Source |
|---|---|---|
| confirm, direct sold | `sold_at` | database clock now, never a client value |
| release, reopen | cleared holder, token, timestamps | write sets them null in the same update |
| direct sold | holder | null by design, offline deals name no buyer |
| public reads | visible set | `listings` columns: `available` and not deleted, or `sold` with `sold_at` inside 7 full days inclusive on the server clock; expired rows drop from cards plus counts plus detail |
| public reads | 7 day window | fixed number constant `SOLD_WINDOW_DAYS` in `src/features/listings/domain/visibility.ts` |
| panel pending row | holder name plus pending age | `users.display_name` joined by `claimed_by_user_id` with fallback `Buyer`, plus `pending_since` |
| panel sold row | sold date | `sold_at` column shown with the existing price date formatter |
| holder detail view | hold banner plus chat link | `claimed_by_user_id` matched to the session plus the stored chat link builder from spec 0003; banner and sold copy reuse spec 0003 wording; back target is `/` |
| stale press | just changed message | zero rows from the conditional write on the expected state |
| logs | listing id, old state, new state, actor id | action inputs plus the row before the write plus the session; sink is the app log and a log failure never blocks the write |
| losing claimer | just taken message with a way back to browse | existing refusal from spec 0002 plus spec 0003, unchanged |

**Key invariants**:
* Exactly one holder per listing. Each owner move is one conditional update that names the expected state, so zero rows means the row moved already.
* One pending hold per buyer stays enforced by the existing partial unique index from spec 0002.
* `pending_since` and `sold_at` always come from the database clock.
* Public queries never return `pending` rows and never return soft deleted rows. Pending slugs stay not found to everyone except the owner and the holder.
* All four owner moves refuse soft deleted rows as not found.
* Transitions revalidate the affected listing pages. The claim safety rule for losing buyers stays exactly as spec 0002 plus spec 0003 define it.
* The owner role never claims and never holds.

**Security model**:
Owner role runs all six writes. Customers and anonymous callers are refused before any read or write. Holder name appears in the admin panel and in the holder own hold banner only, with fallback `Buyer` for a missing user row. The claim token never renders in any UI. Public cards and detail carry no holder data. No payment data and no new personal data. No compliance scope beyond the existing account data.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
* Happy path: claim hides the listing, owner confirms to sold, sold shows then drops after 7 days, verifies **AC-1**, **AC-2**, **AC-5**
* Happy path: owner releases pending to available and the listing returns to cards, verifies **AC-3**
* Happy path: owner marks available direct to sold then reopens to available, verifies **AC-4**
* Failure case: two owner presses race, first wins and second sees just changed, verifies **AC-6**
* Failure case: two buyers claim at once, exactly one holds, verifies **AC-10**
* Auth/permission: customer and anonymous try each owner action and are refused, verifies **AC-7**
* Edge case: expired sold link reads as not found with a way back, verifies **AC-5**
* Edge case: bulk confirm over mixed states returns per id results where one bad row never blocks the rest, verifies **AC-8**

## Build plan

Ordered by the Skateboard approach: thinnest usable whole first (single actions plus read filter), then grown with bulk and polish. No migration in any task.

1. Add the domain transitions plus the conditional owner writes (confirm, release, direct sold, reopen) with wrong state refusal, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-6**, **AC-10**
2. Bind the four single row server actions to the panel with owner checks and transition logs, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-7**, **AC-9**
3. Lock public reads to the 7 day sold window and add the holder own hold banner with chat continuation, satisfies **AC-1**, **AC-5**, **AC-7**
4. Add row buttons (Sold and Release on pending, Mark sold on available, Reopen on sold) plus empty states plus keyboard and focus pass, satisfies **AC-8**
5. Add bulk confirm and bulk release with per id best effort results, cap 50, satisfies **AC-8**

## Consequences

**Positive**:
* The loop closes with the smallest possible surface: four single moves plus two bulk moves over one existing row.
* Expiry costs nothing to operate: no scheduler, no worker, no new secret.
* The claim safety rule stays in one place (the atomic write plus the partial unique index) instead of splitting across features.

**Negative / tradeoffs**:
* Bulk moves add panel weight for a one person shop that may rarely need them.
* Sold history lives only as rows with `sold_at`. Any later sales report must read those rows and cannot know offline prices beyond the listed price.
* The fixed 7 day window cannot vary per listing without a later column and migration.

**Neutral**:
* `SOLD_WINDOW_DAYS` stops being a placeholder and becomes the owned constant. Spec 0002 test hooks that fix it stay valid.

## Follow-up

* [ ] Payment on the site stays deferred. Confirm still means paid on WhatsApp by human judgment.
* [ ] Pending auto release stays deferred. A forgotten pending waits for the owner.
* [ ] Sold and sales history stays deferred. Confirm keeps the holder id but adds no ledger.

## Rationale

Reasoning and options: see rationale.md.
