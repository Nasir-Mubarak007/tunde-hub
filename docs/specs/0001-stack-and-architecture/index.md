# 0001. Stack and architecture for the account storefront

**Date**: 2026-10-12
**Status**: In Progress

## Summary

This spec records the foundation the whole shop is built on: Next.js on TypeScript, a hosted Postgres database, one owner login, hosted image storage for screenshots, and free tier hosting. It is written so a single developer can ship the whole product in Slice 1 without a single paid service. The application pattern is one deployable monolith (a single app that does everything), because the whole product is small enough that splitting it would only add work.

## Decision

**Chosen option**: Option 1: A single Next.js application on free tier managed services.

One Next.js application (the whole product in one deployable unit) with server rendered pages, talking to a hosted Postgres database, storing screenshots in hosted object storage, and running the one recurring job on the host's scheduler. No separate API server, no queue, no cache service, nothing that needs to be operated.

**Where the pieces live and who does what**:
- Public pages are server components (rendered on the server, so search engines and slow phones both cope).
- Every write is a server action (a function called from a form), with plain route handlers only where an outside caller needs a URL.
- Routes that touch image uploads or the database run on the Node runtime, not the edge runtime, because the upload library and the pooled database connection both require it.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Architecture pattern | Monolith, one deployable unit | The whole product is one entity and one admin; splitting it would cost three times the work to operate for no gain. |
| Language | TypeScript | A listing missing a price or an image is caught while you write the code, not by a customer seeing a blank card. |
| Framework | Next.js 16, App Router | Stable and settled, renders on the server for search engines, handles images, and gives one codebase for the shop and the admin panel. |
| Rendering and writes | Server components for reads, server actions for writes | No client side data fetching library to install, learn, or keep in sync. |
| Primary DB | Neon Postgres, reached with the standard `postgres` (node-postgres) driver over Neon's pooled connection string | Real Postgres with a permanent free plan, no card needed, and it scales to zero when the shop is quiet so it costs nothing. One driver serves both the app and the migration tool, so there is no second connection style to keep straight. |
| Data access | Drizzle ORM with `drizzle-kit` migrations | Schema defined in TypeScript, thin over plain SQL, and the claim query that stops two buyers taking one listing stays readable. |
| Validation | Zod | One set of rules shared by the admin forms and the database types, so a price can never be saved as text. |
| Auth | Better Auth, email and password, self hosted | Chosen by the engineer over a plain hand rolled password login and over Clerk. It stores the one owner user in your own Postgres, costs nothing at one user, and is actively developed. |
| Auth tables | Generated into the Drizzle schema | Chosen by the engineer over letting Better Auth's own migration tool own them, so every table and every migration lives in one history. Accepted cost: a Better Auth version bump can touch your migration files. |
| File storage | UploadThing, one file per image width | Chosen by the engineer over Cloudflare R2 and Cloudinary. Made for Next.js, with unlimited downloads and a Next.js native upload flow. The free allowance is the least durable of the four free tiers and must be rechecked before relying on it. |
| Image handling | Resize in the browser, then upload three widths (320, 768, 1200) as three files | UploadThing does not resize, so the sizes are produced before upload. The browser then downloads the smallest width that suits the screen. Maximum 6 screenshots per listing, so at most 18 files per listing. |
| Background jobs | One Vercel cron per day hitting a route whose path carries `CRON_SECRET`, hiding sold listings past their window | One scheduled call is the whole requirement, and once a day is the most the free hosting plan allows. A queue would be absurd here. |
| Hosting | Vercel Hobby | Free, deploys from GitHub on every push, and the fastest path with Next.js. |
| Local development | A development branch on the same hosted database | Chosen by the engineer over a local Postgres container, so the schema matches production exactly and there is no container to run. Accepted cost: a stray test row on the branch is still a row in your hosted account. |
| Observability | Sentry free tier, plus Vercel logs | You get an email when something breaks, with the listing that broke it. Worth it because a silent failure here means a buyer clicks a dead link. |
| Rate limiting | A click table in the same Postgres, counting a keyed hash of the visitor's address per hour, with rows older than 30 days deleted by the daily job | No new service to sign up for, works across server instances, no address is stored in the clear, and the table cannot grow forever. |
| Money | A whole number amount plus a currency code column, formatted with `Intl.NumberFormat` | Naira has no decimal part in practice, so nothing is multiplied or divided on the way in or out. Storing the code alongside lets you change currency later with no data migration. |
| Reading policy | Public pages always read live from the database, never served from a cache | A price or photo you just changed is live the instant you save. At this traffic the speed difference is irrelevant, and a stale price in a shop is worse than a slow one. |
| Filtering and sorting | Filter and sort values live in the page's URL, read on the server | Buyers can share a filtered view, and the browser back button behaves. No client side fetching library. |
| Search visibility | `noindex` on all public pages, no sitemap | Your inventory should not appear in searches you did not choose. |
| Version control | Local git repository plus a public GitHub repository, with `.env*` ignored | History and safe deploys from GitHub. The public choice is safe only because no secret is ever committed. |

## Configuration required

- `DATABASE_URL`: the Postgres connection string the running app uses. It points at the development branch on your machine and at the production branch on Vercel, and nothing else changes between the two.
- `DIRECT_DATABASE_URL`: the direct connection used by migrations only, never by the running app.
- `NEXT_PUBLIC_APP_URL`: the app's public origin, used for canonical links.
- `BETTER_AUTH_SECRET`: signs session cookies.
- `BETTER_AUTH_URL`: the app's public origin as the auth library sees it.
- `OWNER_EMAIL`, `OWNER_PASSWORD`: read once by the owner creation script and never at runtime. Delete `OWNER_PASSWORD` from Vercel straight after the first successful run.
- `UPLOADTHING_TOKEN`: server side token for image uploads.
- `SENTRY_DSN`: error reporting.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`: needed at build time so the Sentry source maps upload.
- `CRON_SECRET`: the token the daily job path carries, so only Vercel can trigger it.

Every one of these lives in `.env.local` on your machine and in Vercel environment variables. None goes into the repository or into the browser bundle. A committed `.env.example` with blank placeholders is required, since the repository is public and someone must be able to see which values to fill in.

## Setup and conventions the scaffold must follow

- **Runtime**: routes that touch the database or image uploads run on the Node runtime, because the driver and the upload library both require it.
- **Bundling**: the Postgres driver is declared as an external package, so the build does not try to bundle it and fail.
- **Schema order**: Better Auth's generated tables enter the Drizzle schema first, then your own migrations run. Better Auth's tables must exist before the app is expected to serve a login.
- **Owner creation**: one script, idempotent by owner email, so running it twice changes nothing. It is never invoked by the running app.
- **Screenshot pipeline**: the browser resizes each picked screenshot to 320, 768, and 1200 pixels wide, correcting for the rotation phone cameras record, then uploads all three as separate files. Maximum 6 screenshots per listing, each with an explicit order.
- **Everything that reads a listing reads it live.** No caching layer, and no route that serves a listing from a stale copy.
- The only scheduled job is the daily one. Once a day is the ceiling the free hosting plan allows, so an hourly variant is not available without a paid plan.

## Consequences

**Positive**:
- Nothing costs money at your volume, and no service requires a card to start.
- One codebase, one deploy, one database. There is no distributed system to debug at 2am.
- The claim action that stops two buyers taking one listing is a single atomic database update, the cleanest possible form of that rule.
- Search engines stay out of the way, and your inventory is not indexed.
- Buyers on mobile data download the smallest screenshot that suits their screen, and an edit you save is live at once.

**Negative / tradeoffs**:
- Three vendors now sit under your app: Vercel, Neon, and UploadThing, plus Sentry for errors. Each one is a free plan, and each free plan can change its terms or limits.
- UploadThing's free allowance is the least durable of the four. Recheck it before you rely on it, and expect to move to Cloudflare R2 if it changes for the worse.
- UploadThing does not resize, so the three width upload pipeline, the phone photo rotation handling, and the per listing file cap are code you own and must maintain.
- Better Auth is more machinery than one owner strictly needs. Its tables are generated into your Drizzle schema by choice, so a Better Auth version bump can land in your migration history and needs reviewing.
- Developing against a hosted branch means there is no container to run, but also no hard wall between test data and your hosted account. A careless script can still write to it.
- Once a day is the most the scheduled job can run. If you later need a sold listing to disappear within the hour, that requires a paid plan.
- Free tiers have limits you must respect, and Neon scaling to zero means the first request after a quiet night is slower.
- Next.js version churn is real. Pinning to major 16 and upgrading deliberately is the mitigation.
- A single monolith means the admin panel and the public shop share one deploy, so a broken deploy takes both down. At this scale that is an acceptable trade for shipping fast.

**Neutral**:
- Vercel runs the app across several machines at once, so nothing may be kept in process memory between requests. Every piece of state, including the rate limit counts, lives in Postgres.
- Public pages are never cached, so there is no cache to invalidate and no stale price to explain to a buyer.
- Money never moves through this app, so there is no payment compliance scope.

## Follow-up

- [ ] The repository is public, so confirm `.gitignore` covers `.env`, `.env.local`, and `.vercel` before the first commit, and that `OWNER_PASSWORD` is never written into any file that gets committed. A leaked owner password plus a leaked listing database is the one realistic way this app hurts you.
- [ ] Selling accounts that belong to Instagram, X, or other platforms may breach those platforms' terms of service, and the risk lands on you rather than on any code. This is a business and legal question, not an engineering one, and it is worth settling before the shop takes real money.
- [ ] `AGENTS.md` does not exist yet. Scope feature 2 (`/audit`) creates it from the real scaffolded project, after the stack is stood up.
- [ ] Scope feature 3 (data model) owns the listing table, the claim rule, and the click table for rate limiting. This spec deliberately does not design them.
- [ ] Scope feature 5 (storefront) owns the WhatsApp deep link and its prefilled message text. This spec only fixes that the link is built from stored listing values.

## Rationale

Reasoning, options, and references: see [rationale.md](rationale.md).
