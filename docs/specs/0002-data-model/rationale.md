# Rationale for 0002, data model

The decision record for [index.md](index.md). Read this when you want the why. `/develop` does not need it.

## Context

> ⚠️ Premise note: during the design interview the engineer asked that buyers have identities and sign in before seeing the full details of an account. That pulls the deferred "Buyer accounts and sign up" idea out of the deferred list and into this spec's data model, and it changes feature 5 (the storefront must now gate one page and present sign in). The signup and sign in surfaces themselves land in features 5 and 6; this spec only supplies the data: the role column, the buyer fields, and the claim that names a buyer.

TundeHub sells social media accounts from a public shop and sends buyers into WhatsApp to finish the deal. One owner manages the listings from a private panel. The forces that shaped this data model:

- **One hard correctness rule.** Two buyers must never both end up with the same account. That rule is safer as a single atomic conditional update inside Postgres than as application code, because the app runs on several machines at once and two requests can both pass an if check.
- **Buyer identity is now real.** Buyers sign up and sign in, so a claim stops being anonymous and starts naming a person the owner can refer to in the panel.
- **Very low volume.** A few hundred listings and one owner. Nothing here is designed for scale; the schema is for clarity and safety, not throughput.
- **Free tiers everywhere.** Neon's free Postgres, Vercel's free hosting, UploadThing's free storage. Tables must not grow without bound, which is why the click counts have a 30 day retention and why screenshots are capped.
- **Mobile first and honest search.** Buyers arrive from shared links on phones, and the storefront is not meant to be indexed. Cards must stay public and light; the rich detail sits behind the buyer login.
- **No payment on the site.** Money never moves through this app, so the data model does not hold payment records.

Two prior decisions constrain this design: Better Auth owns the login tables and its schema is generated into the Drizzle migration history (spec 0001), and screenshots are resized in the browser into three widths before upload (spec 0001). This spec builds on both rather than redeciding them.

## Options considered

### Option 1: One schema with buyer identity, claim fields on the listing, and the atomick write as the backstop

The `users` table gains a role and a display name. Each listing carries its own claim fields, `claimed_by_user_id`, `claim_token`, `pending_since`, sold and delete timestamps, and the status. The claim is one conditional update guarded by `status = 'available' AND deleted_at IS NULL`. Recommended.

**Pros**:
- The one safe guarantee is a single statement, the strongest form available for free.
- No join needed to read whether a listing is free; the public page reads only the listing row.
- Identity lives in one Better Auth user table, so one login flow serves the owner and the buyers, and a role column gates both surfaces.

**Cons**:
- The one pending claim per buyer rule spans rows, so it needs transactional application logic on top of the atomic write.
- Claim fields sit on the listing row, so reselling after a release must clear them cleanly.
- A future full sales history would need a separate table; that is a later feature, not this one.

### Option 2: Anonymous claims, no buyer accounts

The original deferred shape. Browsing stays public, the detail page too, and a claim is an anonymous status flip with no claimant identity.

**Pros**:
- Smallest possible data model, no sign up surface, nothing to protect beyond the listing.
- No buyer personal data at rest.

**Cons**:
- The owner cannot see who holds a pending listing, so the WhatsApp deal has no record behind it.
- No way to stop one person cornering several listings, since there is no identity to rate against.
- The engineer explicitly asked for buyer ids and a sign in gate, so this option is only the baseline it grew from.

### Option 3: A separate claims table instead of claim fields on the listing

Every claim inserts a row in `claims` with listing id, buyer id, token, and timestamps.

**Pros**:
- Every claim leaves a row, which is a foundation for sales history later.
- The listing row stays short and claim data never needs clearing.

**Cons**:
- The public availability read must check or join a second table for every card.
- Sale history is explicitly deferred in the scope, so the extra table is machinery for a feature that is not being built.
- The one pending cap and the atomic take become a two step transaction across two tables either way.

### Option 4: Role as a separate buyers table instead of a column on the Better Auth user

A `buyers` table with a foreign key to `users.id` holds the customer profile.

**Pros**:
- The Better Auth generated user table stays untouched through our migrations.
- Buyer specific fields have their own home.

**Cons**:
- Two tables must be joined to answer "who is this person", on every panel read.
- The owner and the buyers split across two tables for no benefit at one owner and a handful of customers.
- Adding the role to the generated user is the widely used pattern and stays one migration.

## Rationale

Option 1 wins because the shape of the data follows the one guarantee that matters. The claim rule is an atomic conditional update, which is the cleanest possible expression of "one buyer per listing" and the same mechanism named in spec 0001. Putting the claim fields on the listing row keeps the public availability read to a single table, which matters on a phone on mobile data. Buyer identity lives as a role on the Better Auth user so there is one login flow and one user table, avoiding a second table to join for "who is this".

The choices inside the model follow the same logic. The slug is generated once and frozen so shared WhatsApp links never break when a title changes. Age is one integer of total months because it sorts and filters cleanly and displays as years and months; two columns could disagree. Price stays a whole number with a currency code, per spec 0001. The click table keeps the keyed hash per hour bucket and the 30 day retention from spec 0001, and now also guards signups since signup is a public write that bots would otherwise abuse for free.

Two rules needed thought. The "at most six screenshots" cap lives in Zod, not the database, because the widths make six screenshots eighteen rows and a count constraint would demand a trigger for a rule the form already knows. The "one pending claim per buyer" cap lives in the claim use case's transaction, because it spans rows and a database can only express it with more machinery than it is worth at this volume; the atomic status write stays as the backstop underneath it.

The soft delete is a deliberate choice against the usual advice to hard delete. Restoring a misclicked listing and keeping its row intact until you decide to purge it matter more here than keeping queries tidy, and a single owner makes the extra filter discipline cheap. Claim history is not retained; releasing a listing clears its claim fields. The owner is kept out of claims by role, so the shop cannot buy its own stock. Feature 7 owns the state transitions and the sold window; this spec supplies the fields they write to.

## References

**Project sources** (verifiable, in this repo):
- `docs/scope/scope.md`, the Data model feature row, its done when rule, and the deferred "Buyer accounts and sign up" line
- `docs/specs/0001-stack-and-architecture/index.md`, the stack this model builds on: Better Auth with generated tables, the keyed hash rate limit, whole number money, the three width screenshot pipeline, and the one daily job
- `AGENTS.md`, the Clean Architecture layering rules this feature's code must follow

**Practices & standards**:
- Atomic conditional writes to enforce a single owner invariant under concurrency
- Rate limiting any public write endpoint, using a keyed hash so no raw address is stored
- One identity table with a role column to gate separate surfaces at low staff count
- Archive style soft delete with an explicit timestamp where restore matters more than query tidiness