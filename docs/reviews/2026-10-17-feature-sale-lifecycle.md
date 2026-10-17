# Review, feature/sale-lifecycle, 2026-10-17

**Reviewed by**: opencode/space-bunny-free (session model; the engineer reported the author was a different model or provider, so this is a degraded cross model guarantee)
**Scope**: 126 files, branch vs base `main` (merge base `014ac9a`)
**Verdict**: Changes requested

## Summary

Spec 0005 closes the sale loop: four owner moves (confirm, release, direct sold, reopen) plus two bulk moves over the existing `listings` row, a 7 day sold window decided in SQL, a holder hold banner, a transition log, and the panel buttons and empty states. The architecture is genuinely disciplined and mostly right: the conditional-write pattern is exactly as specified, ports are declared in `domain` and implemented in `infrastructure`, failures are values with kebab-case codes and `assertNever`, every export carries a doc comment, and the sold window is one owned constant read by both the card query and the detail gate. Three majors hold it back: a full-row `saveListing` from the edit and soft-delete paths can silently revert a sale move or a claim, the new panel is built on 20 inline style props instead of the stylesheet the project names as its single styling source, and the lifecycle timestamps are timezone-naive columns written from two different clocks. The runtime findings already recorded are all real and two of them have a structural cause in `adminList.tsx` that this review names.

## Major

### 🟠 A full-row save can silently revert a sale move or a claim, `src/features/listings/infrastructure/drizzle/listingRepository.ts:85`

**Problem**: `saveListing` writes `status`, `claimedByUserId`, `claimToken`, `pendingSince`, `soldAt` and `deletedAt` from the entity the caller read, with no guard on those columns and no version check. `updateListingForOwner` (`src/features/listings/application/updateListing.ts:47`) and both soft-delete and restore (`src/features/listings/application/listingLifecycle.ts:38`) re-read inside the use case and then call `saveListing`. Every other owner move in this feature is one conditional `UPDATE` naming the expected state, so it cannot clobber a concurrent write. These two paths are not.

**Why it matters**: A buyer claims listing X while the owner's edit submit for X is between its re-read and its save. The save writes `status: "available", claimedByUserId: null` back over the pending row. The claim is gone, the listing is public and claimable again, the buyer's hold banner still says "you hold this account", and no `listing.transition` line is written, so AC-9 has a hole and AC-10's exactly-one-holder guarantee is defeated by an unlogged overwrite. The reverse is just as reachable: an edit or a soft delete landing after a confirm writes `status: "pending"` and a null `sold_at` back, so a completed sale silently becomes claimable again. The window is one round trip, so it is not constant, but the panel's own AC-6 step deliberately drives two owner tabs at the same row, and the panel and the edit form are separate pages the same owner uses side by side.

**Suggested fix**: Stop writing lifecycle columns from the edit and lifecycle paths. Either narrow `saveListing` to the editable fields only (title, description, platform, price, currency, follower count, age, `updatedAt`) so a stale entity cannot resurrect a state, or give those paths the same conditional-write treatment the sale moves have, naming the state the row must still be in and refusing with the same just-changed message. Then add a verify step: confirm sold while an edit submit is in flight leaves the row sold.

### 🟠 The panel is built on inline style props instead of `globals.css`, `src/features/listings/presentation/adminList.tsx:157`

**Problem**: `adminList.tsx` carries 20 inline `style` objects (plus 3 in `adminOverview.tsx:30` and 1 in each admin page for `--owner-surface`), hardcoding `padding: "8px"`, `gap: 8`, `fontSize: 13`, `minHeight: 44` and a whole `<table>` layout. `globals.css` has no table, row or panel-layout rules to match, so nothing was duplicated, but nothing was added either. Root `AGENTS.md` and `src/app/AGENTS.md` both state that `globals.css` is the single source of truth for styling, with CSS variables and BEM class names, and `design.md` says never invent a part per screen. `docs/scope/scope.md` records that the spec 0004 parts rollout landed only partially and that the ruling is now no utility classes, which leaves hand-written stylesheet classes as the sanctioned path.

**Why it matters**: This is the owner's whole work surface and it is the one screen with no stylesheet presence, so nothing in it can be themed, made responsive or reused when spec 0004's migration reaches the panel. It is also the screen most likely to need it: `design.md` opens on selling from phones, and this table has no phone treatment beyond `overflowX: auto` around six controls per row, with 44px touch targets written inline rather than owned by a token rule.

**Suggested fix**: Add a small set of BEM classes for the admin table and panel layout to `globals.css` (`.admin-table`, `.admin-table__cell`, `.admin-actions`, `.bulk-bar`, using the existing spacing and radius vars) and move the inline props onto them. If part of it is deliberately deferred to the 0004 migration, say so in the file's doc comment and in the scope's debt list so it reads as a decision rather than a drift.

### 🟠 Lifecycle timestamps are timezone-naive columns written from two different clocks, `src/features/listings/infrastructure/drizzle/schema.ts:41`

**Problem**: `pending_since`, `sold_at`, `created_at` and `updated_at` are `timestamp` (no time zone), while spec 0005's data model names them `timestamptz`. Drizzle sends Date values as `toISOString()` and reads them back by appending `+0000`, so every stored value is read as UTC. `saleStore` writes `sold_at` and `updated_at` from `now()`, the database clock. `claimStore.ts:80` writes `pending_since: input.now` and `updatedAt: input.now` from the **application** server clock. Spec 0005 states twice that both `pending_since` and `sold_at` come from the database clock, and `AGENTS.md` in `src/features/listings` names the `saleStore` exception explicitly, so the code and the spec disagree on one of the two columns.

**Why it matters**: Under a UTC database both clocks agree and nothing shows, which is why the runtime check passed. Move the database session to any other `TimeZone` and `now()` lands in `sold_at` as local wall clock while drizzle still reads it as UTC: the 7 day window silently becomes 7 days plus the offset on both cards and detail (they agree with each other, so the bug is invisible in a card-versus-detail comparison), `soldOn` in the panel can print the wrong day near midnight, and `pending_since`, written on the other clock, stays on the original scale, so the panel ends up showing a pending age and a sold date that disagree about which day it is. `verify.md:42` already names this scenario, and it was not among the confirmed checks.

**Suggested fix**: Make the columns `timestamptz` (`timestamp(..., { withTimezone: true })`) so the column type carries the offset, and write `pending_since` from `sql\`now()\`` in `claimStore` the way `saleStore` does, so one clock owns every lifecycle stamp on the row. If the migration is not wanted now, at minimum align the spec's wording with the code and pin the database `TimeZone` to UTC explicitly rather than relying on the provider default.

## Minor

### 🟡 The move message is structurally dropped when the last row leaves the bucket, `src/features/listings/presentation/adminList.tsx:239`

**Problem**: `AdminList` early-returns the empty state at line 239, before the `role="status"` message block at line 262. Confirming the last pending row empties the bucket, so the component renders the empty state and the "Done." or just-changed message is never mounted.

**Why it matters**: AC-6 promises a stale press refuses with a just-changed message; on the last row of a bucket the owner gets silence plus a re-rendered empty state, and the screen reader has nothing to announce. The deeper cause is structural, not a missing line: the announcement node lives inside the same branch that competes with the empty state, so any bucket-draining move loses it.

**Suggested fix**: Hoist the message out of the `items.length === 0` early return so the status region renders in both branches, and move focus to it (or to the empty state's heading) after a move instead of letting it fall to `document.body`.

### 🟡 Disabled state is presentational, with no feedback path, `src/features/listings/presentation/adminList.tsx:177`

**Problem**: The bulk buttons use `aria-disabled={busy || chosen.length === 0}` on a real `<button>`, and `runOnSelected` (`adminList.tsx:230`) silently returns when the selection is empty. The "Pick at least one listing first" copy in `adminListingActions.ts:83` is therefore unreachable from the UI. The guard is now written in three places: the component's early return, the action's `listingIds.length === 0` check, and the use case's `empty-selection` error.

**Why it matters**: `aria-disabled` announces the state but does not stop activation, so a keyboard user pressing an announced-as-unavailable button gets no feedback at all, and the one piece of copy written for that case is dead. Known runtime finding; the deeper cause is the triple guard, which is why the message can never surface.

**Suggested fix**: Keep `aria-disabled` for the busy state (it is the right call for keeping focus), but let the empty-selection press fall through to the action so the message renders, or surface it locally from the component. Then delete whichever guard turns out to be redundant so there is one owner for the rule.

### 🟡 Holder name disappears on sold rows even though the holder is kept, `src/features/listings/presentation/adminList.tsx:309`

**Problem**: The panel renders `Held by {holderName(item)}` only when `item.status === "pending"`, but confirm deliberately keeps the holder on the row (AC-2), and `listAllForAdmin` (`listingRepository.ts:190`) already joins the holder for every status, sold included. The DTO carries it and the render throws it away.

**Why it matters**: The owner loses the record of who bought an account the moment they confirm it, on the one screen that exists to finish deals. Known runtime finding; the cause is a render gate narrower than the query and the spec.

**Suggested fix**: Render the holder whenever `holder` is present and the row is not deleted, with the wording reflecting the state (`Held by X` while pending, `Sold to X` once sold), and keep the `Buyer` fallback.

### 🟡 `claimToken` is written and cleared by three moves but never read, `src/features/listings/infrastructure/drizzle/saleStore.ts:66`

**Problem**: `claimToken` is generated in `container.ts:68`, written by `claimStore`, kept by confirm, and nulled by release and reopen. Grep across `src` shows no read that influences any decision: the holder is matched by `claimedByUserId`, never by the token.

**Why it matters**: Three lifecycle moves carry a column whose only effect is a unique index. Every future reader has to work out whether it is a live secret or dead weight, and a unique-constraint violation on a token nobody uses would surface as an unexplained write failure.

**Suggested fix**: Either document the token's purpose in `domain/listing.ts` where it is declared and use it to gate the holder match in `findBySlug`, or drop it from the lifecycle in a later migration once the sale loop is stable.

### 🟡 The 7 day rule exists twice, and the in-memory copy breaks the "decided in SQL" rule, `src/features/listings/domain/visibility.ts:43`

**Problem**: `listAvailableCards` decides visibility with `gte(listings.soldAt, query.soldCutoff)` (`listingRepository.ts:132`) while `findBySlug` decides the same rule in memory through `isPublicCardVisible` (`application/findBySlug.ts:61`). Only the SQL side takes the cutoff as a parameter; the domain function recomputes it from `now`.

**Why it matters**: `AGENTS.md` says public visibility is decided in SQL, never in memory, and the two implementations can drift silently: a change to the edge (inclusive versus exclusive), the window, or the clock source lands in one and not the other, and the failure mode is a card that disagrees with its own detail page. They agree today only by coincidence of two independent implementations of the same sentence.

**Suggested fix**: Push the cutoff into the slug lookup so both surfaces read the same SQL predicate, and keep `isPublicCardVisible` only where a plain object is genuinely in hand, with a comment saying which is which.

### 🟡 `new Date()` in a client component body, `src/features/listings/presentation/adminList.tsx:200`

**Problem**: `const now = new Date()` runs in the render body of a `"use client"` component, and its value feeds `pendingAge`. The project rule is that `now` is always passed in and only `container.ts` and the server actions call `new Date()`.

**Why it matters**: Two problems. The server render and the hydration render each compute their own clock, so the age text can differ across a midnight boundary and React will patch text it just rendered. And it makes the value untestable and unmockable, since it cannot be injected.

**Suggested fix**: Format `pendingSince` into a display string on the server, next to `priceDisplay` and `ageDisplay` in `toAdminListingDto`, and drop `pendingAge` and `now` from the client.

### 🟡 `AdminListingDto` sends raw `Date` objects to a client component, `src/features/listings/application/adminListingDto.ts:25`

**Problem**: `createdAt`, `pendingSince` and `soldAt` cross the server-to-client boundary as `Date`, which is the documented exception in `src/features/listings/AGENTS.md` on the grounds that "the admin page renders dates on the server". It does not: `soldOn` and `pendingAge` both run in the client component.

**Why it matters**: The recorded rationale for the exception no longer holds, so a reader cannot tell whether the `Date` in the payload is deliberate. It also ships three more serialized values per row to the browser for formatting that could happen on the server.

**Suggested fix**: Fold the two display strings into the DTO and drop the raw dates, which resolves this finding and the one above together.

### 🟡 Exhaustive switches that do not end in `assertNever`, `src/features/listings/presentation/adminList.tsx:130`

**Problem**: `SaleButtons`'s `default` returns `null` and `emptyCopy`'s `default` duplicates the `"all"` branch (`adminList.tsx:70`). Both switches cover `ListingStatus` or `AdminStatusFilter` exhaustively, so the defaults are unreachable.

**Why it matters**: The project rule is explicit that every exhaustive switch ends in `assertNever()`, and the rest of the codebase honours it (`listingStatus.ts:30`, `adminListingActions.ts:73`, `visibility.ts:63`). These two are the exceptions, and a `return null` default will silently swallow a future status instead of failing the typecheck.

**Suggested fix**: `return assertNever(status)` and `return assertNever(status)` in both, with the `"all"` copy hoisted so the fallthrough does not duplicate it.

### 🟡 Selection can change mid-move, and one row move clears the whole selection, `src/features/listings/presentation/adminList.tsx:203`

**Problem**: `toggle` has no `running` guard, so the row checkbox and the select-all checkbox stay live during a move, and `runOnRow` calls `setSelected(new Set())` after **any** single row move, not just bulk ones.

**Why it matters**: The owner can tick a row mid-flight and see the selection change after the move reports "Moved 2", with no way to tell which two. And pressing a single row's Sold button discards a bulk selection they were halfway through building, which is the kind of surprise that loses trust in a bulk tool.

**Suggested fix**: Ignore `toggle` while `running` is true, matching the buttons, and only clear the selection after a bulk move, or after a row move that invalidates it.

### 🟡 A refused move purges the whole public listing route, `src/features/listings/presentation/adminListingActions.ts:248`

**Problem**: `revalidateSalePages(null)` calls `revalidatePath("/admin")`, `revalidatePath("/")` and `revalidatePath("/listings/[slug]", "page")`. On a failure the slug is `null`, so every refused move, including every `wrong-state` and `just-changed` refusal, invalidates the grid and every detail page.

**Why it matters**: A refusal changed nothing on the public side, and it drops the cached storefront and the entire dynamic listing route. It is cheap at this traffic, but it is the wrong shape: the invalidation should follow what actually changed, and it will get more expensive as listings accumulate.

**Suggested fix**: Revalidate only what the move can have changed: `/admin` always, plus `/` and the one slug when the write succeeded, plus the dynamic route only for a bulk press.

### 🟡 Bulk runs two queries per row, serially, up to 100 round trips, `src/features/listings/application/saleLifecycle.ts:181`

**Problem**: Each bulk row does a `findById` then a conditional `UPDATE`, awaited one after another, capped at 50 ids.

**Why it matters**: The conditional write already carries the guard, so the pre-read exists only to tell `wrong-state` apart from `just-changed`. That is a real UX distinction, but it doubles the round trips and couples the panel's responsiveness to list length; at the cap it is 100 serial queries on one serverless invocation. It also means the "just changed" answer is a best guess from a read that may already be stale.

**Suggested fix**: Keep the pre-read only for the single-row moves where the message matters, and let bulk rely on the conditional write, or batch the reads for the selection into one `IN` query before the loop.

### 🟡 `saleLifecycle.ts` is missing from the application barrel, `src/features/listings/application/index.ts:15`

**Problem**: Every sibling use case module is re-exported; `saleLifecycle` and `adminOverview` are not. The AGENTS note says `adminOverview` is intentionally left out, so the omission of `saleLifecycle` reads as an oversight rather than a decision.

**Why it matters**: Small, but it is the kind of inconsistency that makes a barrel untrustworthy as an index, and the container currently imports it by path.

**Suggested fix**: Add the line, or note the exclusion next to the `adminOverview` note.

### 🟡 A buyer who just completed a purchase loses the chat link, `src/features/listings/presentation/listingDetail.tsx:25`

**Problem**: `panelKindFromClaim` returns `"sold"` as its first branch, before it looks at `heldByViewer`, so the confirmed holder sees the sold panel with no chat link for the whole 7 day window.

**Why it matters**: The buyer has just paid off-site and still needs a way back to the seller with the listing named. Spec 0005's value sourcing table puts the chat link on the holder detail view, and after confirm the holder is still on the row by design, so the link disappearing exactly when money changed hands is probably not intended. It may well be deliberate; nothing records that either way.

**Suggested fix**: If it is deliberate, say so in the spec's value sourcing row. If not, check `heldByViewer` before the sold branch and give the holder a sold panel that still carries the chat link.

## Nits

- ⚪ `src/features/listings/infrastructure/appTransitionLog.ts:13`, AC-9's audit trail is `console.info`, so it lives only as long as the platform's stdout retention and never reaches Sentry. That matches the spec's stated sink, but a sale history cannot be reconstructed from it later.
- ⚪ `src/features/listings/infrastructure/drizzle/saleStore.ts:26`, `SaleWrite.soldAt?: Date | SQL | null` allows a caller-supplied `Date` that no caller uses and that would break the database-clock rule if one did. Narrowing it to `SQL | null` makes the rule structural.
- ⚪ `src/features/listings/application/saleLifecycle.ts:66`, the guard's returned `Listing` is discarded and only `.ok` is read, so the domain copy of the next state is computed and thrown away on every move. Worth a comment saying the store owns the written values, or drop the return.
- ⚪ `src/features/listings/presentation/adminList.tsx:152`, `allTicked` drives both the checkbox state and the label, so a partial selection shows an unchecked box labelled "Select all pending on this page" with "2 of 5 selected" beside it. An indeterminate state would read better.

## Strengths

- The conditional-write discipline is real and consistent. Every owner move is one `UPDATE` naming the expected state plus `deleted_at IS NULL`, returns the row or `null`, and `null` maps to a distinct `just-changed` refusal rather than an error. The domain guard and the store's expected state agree for all four moves, which is the kind of thing that usually drifts.
- The stale press design is genuinely good: no version column, the expected state runs server side from the same write, and the refusal distinguishes "you asked for the wrong move" from "someone beat you to it". Two owner tabs racing is the case AC-6 describes and the code handles it without a lost update on that path.
- `SOLD_WINDOW_DAYS` is one owned constant read by both the card query and the detail gate, with an inclusive edge and a testable `soldWindowDays` parameter, so the two surfaces cannot disagree about a magic number.
- The ports are cleanly inverted. `domain/repositories.ts` declares `ListingSaleStore` and `TransitionLog` with their throw contracts written down, `saleStore` and `appTransitionLog` implement them as free functions, and `saleLifecycle` sees nothing but plain objects. The log sink swallowing its own failure after the write landed is the right call and is documented as such in the port.
- Authorization is doubled up correctly: `requireOwnerViewer` gates every action in `adminListingActions.ts`, and `canManageListings` gates again inside `runSaleMove` and `runBulkMove`, so a future caller that forgets the gate still cannot move a row.
- Failure copy is honest throughout. `just-changed` says the panel now shows where the listing actually is, and the bulk message names the skipped count without pretending the whole press failed.

## Test coverage

The project gates on typecheck plus `/check verify` (`test-preferences.json` has `"tool": null`), so no coverage findings are raised. That gate caught all ten acceptance criteria, and the verify steps are unusually good: they read row state with SQL after each move, they test the inclusive window edge at exactly 7 days, they drive the AC-6 race with two real tabs, and `verify.md:42` names the timezone scenario this review's third major is about. Two gaps in that gate are worth closing given the findings above, and neither needs a test runner: add a step that sells a listing while an edit submit is in flight (the lost-update major), and actually run the non-UTC `TimeZone` step rather than only listing it.
