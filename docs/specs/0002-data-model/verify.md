# Verify: data model · spec 0002 · updated 2026-10-14
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] None. This pass is pure data and domain logic with no rendered surface.
## Commands
- [x] `npm run typecheck` → green → AC-1, AC-3, AC-8, AC-9
- [x] `npm run db:migrate` → `users_role_display_name_check` shows up in `pg_constraint` → AC-9
- [x] `npm run seed:owner` with `OWNER_EMAIL` and `OWNER_PASSWORD` set → one owner row with role owner; run it twice → same row id, still one owner → AC-9
- [x] Create a listing with every field plus one screenshot at three widths → row stored as available, three image rows → AC-1, AC-8
- [x] Create it again with the same title → second row with a suffixed slug → AC-1
- [x] Pass a negative price, a seventh screenshot, or a width of 500 → refused with a field issue, no row written → AC-8
- [x] Update the title and price → row changes, slug does not → AC-1
- [x] Run any write as customer or anonymous → refused with not owner → AC-9
- [x] Soft delete → absent from the public cards, still listed for admin marked deleted; restore → back on the cards → AC-7
- [x] Purge → listing row and every image row gone, orphaned file keys returned and logged when the token is missing → AC-7
- [x] Admin list at limit 5 → five items plus a cursor; walk to the end, nothing repeats or skips, and the pending claim names its holder → AC-7
- [x] Sign up with no display name → 400 with "A display name is required." → AC-9
- [x] Six sign ups from one address → first four 200, fifth and sixth 429, and `rate_limit_clicks` holds one hashed row for that hour bucket → AC-6
- [x] Claim from that same address → shares the counter with the sign ups, so the cap covers both → AC-6
- [x] Claim one listing, then claim a second → refused with already has a pending claim → AC-11
- [x] Exercise `createListing` with title, platform, price, followers, age, currency and zero images → ok with status `available` → AC-1
- [x] Exercise `createListing` with a negative price → `price-invalid` → AC-1, AC-8
- [x] Move a listing available → pending via `requestClaim`, then pending → sold via `confirmSold` → ok → AC-3
- [x] Move a listing pending → available via `releaseClaim` → claim fields cleared → AC-3, AC-5
- [x] Move a listing available → sold via `confirmSold` (direct sale) → ok with buyer kept → AC-3
- [x] Run `canClaimListing` for anonymous, owner, current holder, and a buyer with an open pending claim → each refused with its own reason → AC-4, AC-11
- [x] Validate seven distinct screenshot positions → `too-many-screenshots` → AC-8
- [x] Validate one position with only two widths → `incomplete-width-set` → AC-8
- [x] Create a customer user with no display name → `display-name-required`; create the owner with none → ok → AC-9
- [x] Check `isPublicCardVisible` for a listing sold 8 days ago → false; sold today → true → AC-2
- [x] Check `canViewListingDetail` as anonymous for an available listing → false; as customer → true → AC-10
## Value sourcing checks
- [x] Slug → create from a title with accents and punctuation, confirm the stored slug is the slugified form and survives a title change → AC-1
- [x] Admin holder → claim a listing, confirm the admin row shows the display name and email from the users row → AC-7
- [x] Admin price and age → set a price with a thousands separator and 34 months, confirm the formatter output and 2y 10m → AC-1
- [x] Purge file keys → confirm the keys sent to UploadThing are the stored file keys, one per width, never the url → AC-7
- [x] Hour bucket → confirm the signup and claim counters roll at 00:00 UTC, not local midnight → AC-6
- [x] Role → flip a customer to owner by hand and confirm the session reports owner; confirm every signup defaults to customer → AC-9
## Acceptance-criteria coverage
- AC-1 covered by the create, collision and update steps · AC-2 covered by the visibility step · AC-3 covered by the transition steps · AC-4 covered by the guard steps · AC-5 covered by the release step and the claim row query · AC-6 covered by the signup cap, shared counter and UTC bucket steps · AC-7 covered by the soft delete, restore, purge and admin list steps · AC-8 covered by the boundary refusal and image steps · AC-9 covered by the owner script, display name and role steps · AC-10 covered by the detail gate step · AC-11 covered by the second claim step
## Sign in page (auth build 2026-10-14, no spec of its own; serves AC-9, AC-10 and the 0003 prompt target)
- [x] Open `/sign-in` anonymous → brand side plus a card with Sign in and Create account modes → AC-9
- [x] Open `/sign-in?mode=signup` → the card starts on create with a display name field → AC-9
- [ ] Create an account → lands home signed in, header shows the display name → AC-9
- [ ] Sign in with a wrong password → a mismatch message, no session → AC-9
- [ ] Sign in from `/sign-in?next=/listings/<slug>` → returns to that detail page → AC-10
- [ ] Open `/sign-in` while signed in → bounces to the return path → AC-10
- [ ] Open `/sign-in?next=https://evil.test` while signed in → lands home, never leaves this origin → AC-10
- [ ] Sign in as the owner through the same page → the session reports owner → AC-9
- [ ] Sign out from the header → lands home anonymous → AC-10
## Owner panel (panel build 2026-10-16, no spec of its own; serves the feature 6 Done when on spec 0002 use cases)
- [x] Open `/admin` anonymous → lands on sign in with a return path
- [x] Sign in as customer, open `/admin` → lands home
- [x] Sign in as owner, open `/admin` → sees every listing including deleted ones
- [ ] Add a listing with title, platform, price, followers, age, and one photo → shows on `/admin` and on the shop cards
- [x] Edit that listing, change price, followers, and description → new values show, the link stays the same
- [x] Delete it → leaves the shop but stays in the panel; restore it → returns to the shop
- [x] Purge it → listing rows and files go, panel no longer shows it
- [ ] Upload six photos max, a seventh is refused; remove one mid set → positions reorder cleanly
- [ ] Keyboard only pass on `/admin` → skip link first, every control reachable with visible focus, every input labelled, targets 44px or taller
- [x] `npm run typecheck` → green; `npm run build` → all ten routes compile with `/admin` dynamic
## Owner panel buckets (build 2026-10-16, same no spec home; live counts plus status filters on spec 0002 reads)
- [x] Open `/admin` as owner → five counts that add up, total equals live plus pending plus sold plus deleted
- [x] Open each bucket → only that bucket rows show, holder plus age on pending, sold date on sold
- [x] Open `/admin?status=bogus` → full list with a 200, never an error page
- [x] Page one bucket with Load more → filter stays on, rows never repeat
- [x] `npm run typecheck` plus `npm run build` → green with `/admin` dynamic
