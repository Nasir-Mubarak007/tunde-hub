# Scope: Account Storefront

A public shop where people browse social media accounts you are selling, pick one, and get sent straight into your WhatsApp chat to finish the deal. You manage the listings yourself from a private panel.

**Build approach:** Skateboard (ship the smallest whole product someone would actually use, then grow it).
**Workflow:** Beta (`/check verify`, then `/test`). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | in-progress |
| 2 | Coding standards & tooling | Foundation | planned |
| 3 | Data model | Foundation | in-progress |
| 4 | Design system & UI foundation | Foundation | in-progress |
| 5 | Storefront browse and WhatsApp handoff | Slice 1 | in-progress |
| 6 | Owner sign in and listing management | Slice 1 | in-progress |
| 7 | Sale lifecycle: pending, sold, removal | Slice 2 | planned |

## Foundations

### 1. Stack & architecture · in-progress
Decide the stack and scaffold a runnable project so every later slice builds on real structure.
**Done when:** the stack is recorded in a spec and the empty scaffold boots locally and passes build.
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack & architecture` (Next.js 16.4.0 App Router, TypeScript strict, Node runtime, `postgres` marked external, `.env.example`, git repo on `main`)
- [x] Smoke-check it runs: `/test` (gates on typecheck and `/check verify`, no test runner; dev server answered 200, production build green)
Spec [0001](../specs/0001-stack-and-architecture/index.md) · code in `./`

### 2. Coding standards & tooling
Capture conventions, then install lint, format, and pre commit enforcement from the real scaffolded project.
**Done when:** root `AGENTS.md` reflects the real stack, and lint and format run clean.
- [ ] Capture conventions + tooling choices: `/audit`

### 3. Data model · in-progress
The one listing entity, its fields (platform, price, follower count, age, screenshots, status), and the rules that keep two buyers from claiming the same listing. Buyers sign up and sign in to see the full account details; the claim names a buyer.
**Done when:** listings can be stored, listed, marked pending or sold, and never go to two buyers at once.
- [x] Design it (spec): `/architect data model`
- [x] Build it: `/develop data model` (all milestones landed 2026-10-14; `verify.md` steps written, verify not yet run)
  - [x] Schema, migration, and enums for listings, images, clicks, and the user additions (AC-1, AC-6, AC-8, AC-11)
  - [x] Listing entities and repositories (AC-1, AC-3, AC-8)
  - [x] Reads: listAvailable with cursor pagination, gate behind sign in, listForAdmin (AC-2, AC-7, AC-10)
  - [x] Listing writes: create, update, soft delete, restore, purge with file cleanup (AC-1, AC-7)
  - [x] Claim rule, buyer sign up and sign in, owner roles, and the rate limits (AC-4, AC-5, AC-6, AC-9, AC-11)
- [x] Verify it: `/check verify data model` (ran 2026-10-14 against the Neon dev branch, every AC met with live evidence; see the spec verify.md)
- [x] Test it: `/test data model` (gate only by project choice: typecheck green, lint 0 errors, behavior proven by `/check verify`; no runner until the tooling feature lands)
Spec [0002](../specs/0002-data-model/index.md) · code in `./src/features/listings`, `./src/features/auth`, `./drizzle`, `./scripts/seed-owner.ts`

### 4. Design system & UI foundation · in-progress
Visual language, layout primitives, and base components so the shop looks credible and works on a phone, since most buyers will arrive from a link on mobile.
**Done when:** `design.md` covers type, color, spacing and components, and base components handle focus and keyboard.
- [x] Design it (spec): `/architect design system & UI foundation`
- [ ] Build it: `/develop design system & UI foundation` (steps derive from the standard at build time, no milestone rollup here by rule)
- [ ] Verify it: `/check verify design system & UI foundation`
- [ ] Test it: `/test design system & UI foundation`
Spec [0004](../specs/0004-design-system-ui-foundation/index.md)

## Slice 1: Smallest usable whole

### 5. Storefront browse and WhatsApp handoff · Beta
Visitors land on a public page of available accounts, filter by platform, price and followers, sort, open a listing to see screenshots and price, and click through to your WhatsApp chat. This slice is the walking skeleton.
**Done when:** a visitor can see available listings on a phone and on desktop, filter and sort them, open one listing, and land in your WhatsApp chat from it.
- [x] Design it (spec): `/architect storefront browse and WhatsApp handoff`
- [ ] Build it: `/develop storefront browse and WhatsApp handoff`
  - [x] Grid plus detail shell reading live (AC-1, AC-5, AC-8, AC-11, AC-12)
  - [x] Claim plus chat action (AC-6, AC-7, AC-10)
  - [x] URL filters, sort and Load more (AC-2, AC-3)
  - [x] Sold states plus accessibility pass (AC-4, AC-9)
- [ ] Verify it: `/check verify storefront browse and WhatsApp handoff`
- [ ] Test it: `/test storefront browse and WhatsApp handoff`
Spec [0003](../specs/0003-storefront-browse-whatsapp-handoff/index.md) · code in `./src/app`, `./src/features/listings`, `./src/features/auth`

### 6. Owner sign in and listing management · in-progress
You sign in to a private panel with one login of your own, then add, edit and delete listings with platform, price, follower count and screenshots.
**Done when:** you can sign in, add a listing with a photo and price, edit any field, delete a listing, and see your listings listed in the panel.
- [ ] Build it: `/develop owner sign in and listing management` (auth half landed 2026-10-14: `/sign-in` with sign in and create account modes, sign out, owner gate helper; panel plus listing writes still open)

## Slice 2: Sale lifecycle

### 7. Sale lifecycle: pending, sold, removal · needs a decision
A buyer clicking through puts that account into pending and hides it from the public page. You confirm the sale or release it back to available, and a sold listing shows a sold state for a short while before it drops off the site on its own.
**Done when:** a click hides that listing from the public page, you can mark it sold or release it back, a sold listing shows as sold for a set window and then disappears from the site by itself, and two clicks never put two buyers on one listing.
- [ ] Design it (spec): `/architect sale lifecycle`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Taking payment on the site**: card checkout before an account is released · needs a decision · GA
- **Buyer accounts and sign up**: visitors must register before they can browse · needs a decision
- **Auto releasing pending listings**: pending frees itself after a set time instead of waiting for you · needs a decision
- **Sold and sales history**: a record of what sold, to whom and for how much · needs a decision
- **Bulk editing**: import and export your listings from a spreadsheet · needs a decision
- **Alerts when something sells**: an email or message to you at the moment of sale · needs a decision
- **Extra listing detail**: niche, audience country, engagement and verification status · needs a decision
- **Staff logins**: more than one person managing listings · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag means it inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature's rigor above or below the project default; no tag inherits the default. It decides the feature's check boxes and each skill's next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing (trust develop's own build time self check); **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
