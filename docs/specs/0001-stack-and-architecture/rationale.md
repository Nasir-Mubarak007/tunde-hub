# Rationale for 0001, stack and architecture

The decision record for [index.md](index.md). Read this when you want the why. `/develop` does not need it.

## Context

TundeHub is a public shop where buyers browse social media accounts for sale and are sent into the owner's WhatsApp chat to finish the deal. One owner signs in to a private panel to add, edit, and delete listings, and to move a listing through available, pending, and sold. No payment is taken on the site. No buyer account exists.

The forces that shaped this decision:

- **One developer, shipping fast.** The whole product is one entity with a small set of fields. Every service added is a service to sign up for, learn, and keep alive.
- **Very low volume.** A few hundred listings at most, and traffic that arrives as bursts from links shared in WhatsApp. There is no scale problem to solve, so nothing here is designed for scale.
- **Near zero budget.** Everything must fit on a free tier that does not ask for a card.
- **Mobile first.** Buyers arrive from links on phones, often on mobile data, so images must be small and pages must render without much JavaScript.
- **One hard correctness rule.** Two buyers must never end up with the same account. That rule is far easier to enforce in a relational database than in application code, which is the main reason Postgres is not optional here.
- **Nothing that requires a platform engineer.** No containers, no orchestration, no queue, no cache tier.

Not deciding this first would mean every later feature would guess at its foundation, and a wrong data store or auth model discovered in Slice 2 would mean reworking Slice 1.

## Options considered

### Option 1: A single Next.js application on free tier managed services

One Next.js app holding the public shop and the admin panel, on hosted Postgres, hosted image storage, and free hosting. Everything the owner does and everything the buyer does happens inside that one deployable unit. Recommended.

**Pros**:
- One codebase, one deploy, one database, nothing distributed to debug.
- Server rendered pages work on slow phones and stay readable to any crawler that ignores the noindex directive.
- The claim rule becomes a single atomic database update, which is the strongest guarantee available for free.
- Free tiers at every layer, none requiring a card.

**Cons**:
- Four vendors underneath (hosting, database, images, errors), so four sets of terms to keep an eye on.
- A bad deploy takes the public shop and the admin panel down together.
- The app inherits the framework's version churn and its serverless limits, including cold starts after quiet periods.

### Option 2: A hosted backend platform (Supabase or similar) with a light frontend

The platform provides the database, the login, and image storage as one bundle, and the app is a thin frontend over it.

**Pros**:
- One account and one dashboard instead of three services.
- Login and file upload rules come with the platform rather than being written by hand.
- Genuinely fast for a first version, especially for auth.

**Cons**:
- The free tier pauses the project after a week of inactivity and needs a manual restore. A paused database behind a live storefront is a bad failure mode even though a daily shop would rarely go idle for a week.
- The auth and storage conventions belong to the platform, so the app is written against one vendor's shape and is expensive to move later.
- The free database allowance is small enough that image storage shares the same quota as the data.

### Option 3: A static site with a separate functions backend

A prebuilt frontend for the public pages plus standalone serverless functions and a hosted database.

**Pros**:
- The cheapest possible public pages, since there is no server rendering them.
- Very little infrastructure to reason about.

**Cons**:
- The admin panel becomes a second application with its own build, its own routing, and its own form handling, which is a lot of duplication for one user.
- Listing pages need rebuilding or a runtime data fetch, so filtering and sorting move into the browser and the pages stop being readable to any crawler.
- Every admin edit means a rebuild or a separate deploy, so the shop and its owner panel drift into two release rhythms.

## Rationale

Option 1 wins because the product is small enough that its main risk is never shipping, and every extra service converts directly into time not spent on listings and buyers. Server rendered pages in one framework also solve the mobile and search visibility requirements at once, while the same codebase covers the admin panel, so there is one login system rather than two.

The relational database is not a default preference here, it is a requirement. The one invariant that matters, that a listing can be claimed by exactly one buyer, is enforced by an atomic conditional update inside Postgres rather than by application code that two server instances could both pass. A document store cannot express that constraint as cheaply, and a single file database gives no real protection at all.

The engineer expressed a preference for Better Auth over the plain hand rolled password login that was recommended. That is a reasonable override: Better Auth is self hosted on the chosen database, costs nothing at one user, avoids the well known ways hand rolled sessions go wrong, and is actively developed rather than abandoned, which is precisely the risk the recommended option was chosen to avoid. It is a deliberate acceptance, not a free win: one owner needs far less than a full auth library, so the cost is four tables, a schema generation step wired into the migration history, and a migration path that has to be reviewed whenever Better Auth changes. The engineer also chose to have those tables generated into the Drizzle schema rather than owned by Better Auth's own migration tool, which keeps one migration history at the price of coupling a library's internals to it.

The engineer chose UploadThing over Cloudflare R2, trading a larger published storage allowance for a Next.js native integration and built in upload handling. That is the right trade for this product, because the thing that actually bites is how much work the integration costs, and UploadThing removes the most. Its free allowance is the least durable of the four free tiers and is not a fixed bucket the way R2's is, so it is recorded as the first thing to recheck. Because UploadThing stores one file per upload and does not transform, resizing moved into the browser: each screenshot is shrunk to three widths and uploaded as three files. That is more code than any alternative, and it is code the engineer chose knowingly.

Auth.js was ruled out for fit as well as for its maintenance status. Even setting maintenance aside, its credentials flow would have to be reconciled with a self hosted library that already owns sessions, which is two session models to reason about rather than one.

Development runs against a hosted branch rather than a local container. That was chosen over the recommendation, and the honest cost is that a stray test row can still land in your hosted account, with no hard wall between test data and production. The schema matches production exactly, which is the thing that usually causes the painful bugs.

Two choices deserve an explicit note. A daily scheduled job rather than an hourly one is deliberate: a sold listing appearing for up to a day longer is harmless at this volume, it leaves the cron allowance untouched, and once a day is in any case the ceiling the free hosting plan imposes, so the hourly variant was never available. And the click rate limit counts in Postgres rather than in memory or Redis, because the app runs on several machines at once, so anything held in process memory resets constantly and enforces nothing. The visitor's address is stored as a keyed hash rather than in the clear, and rows older than 30 days are removed by the same daily job.

Prices are stored as whole numbers with a currency code beside them. Naira has no decimal part in practice, so the usual store in hundredths would have silently multiplied every price you typed by 100.

A cross check pass on 2026-10-12 reviewed this spec on a second model. It found the driver, the cron authentication, the resize mechanism, the auth schema ownership, the price exponent, the rate limit cleanup, and the environment variable list all under specified, and this record was rewritten to answer each one. It also corrected three arguments that did not hold: the reason given for rejecting the hosted backend platform, a claim that the static option forced hand built auth when the admin panel was never split out, and a flat rejection of Auth.js without a fit argument.

## References

**Project sources** (verifiable, in this repo):
- `docs/scope/scope.md`, the scope rows for Stack and architecture, Data model, Storefront browse and WhatsApp handoff, and the build approach header (Skateboard)
- No `AGENTS.md` exists yet, so no project convention outranks anything here

**Practices & standards**:
- Monolith first for small teams and low scale, extracting only on a measured bottleneck
- A relational database as the default store, with invariants enforced by constraints and atomic conditional writes
- A proven auth library rather than hand rolled session handling
- Serverless cold starts and statelessness, so no state may live in process memory
- OWASP guidance on session cookie flags and secret handling

**Links** (web verified during the landscape check on 2026-10-12):
- Next.js documentation: https://nextjs.org/docs/app/getting-started
- Neon pricing and free plan: https://neon.com/pricing
- Supabase pricing, including the inactivity pause: https://supabase.com/pricing
- UploadThing pricing: https://uploadthing.com/pricing
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudinary pricing: https://cloudinary.com/pricing
- Better Auth: https://better-auth.com
- Clerk pricing: https://clerk.com/pricing
- Auth.js, maintenance only since September 2025: https://authjs.dev
- Drizzle ORM: https://orm.drizzle.team
- Prisma documentation: https://www.prisma.io/docs
- TanStack Start: https://tanstack.com/start/latest
- Astro: https://astro.new
- React Router framework mode, the successor to Remix: https://reactrouter.com

**Freshness notes**: Next.js App Router pricing and docs, Neon and Supabase published plans, and R2 and Cloudinary published pricing were confirmed. TanStack Start remains a release candidate and Prisma had just released a major version, so both were ruled out rather than on merit. Auth.js being maintenance only was the deciding fact against it.
