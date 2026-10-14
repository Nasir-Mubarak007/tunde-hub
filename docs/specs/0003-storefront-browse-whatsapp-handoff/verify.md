# Verify: Storefront browse and WhatsApp handoff · spec 0003 · updated 2026-10-14

_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Open `/` as an anonymous visitor → cards show cover, platform, follower count, age and price, in two columns on a phone and four on desktop → AC-1
- [ ] Open `/listings/<slug>` as an anonymous visitor → sign in prompt, no facts, no gallery, no claim button → AC-5
- [ ] Sign in as a buyer, open the same listing → gallery, price, the facts rows, the description and the claim button → AC-4
- [ ] Set platform, max price, min followers and sort, press Apply filters → the url carries `platform`, `maxPrice`, `minFollowers`, `sort`, `direction` → AC-2
- [ ] Open that same url in a private window → the same cards in the same order → AC-2
- [ ] Visit `/?platform=bogus&maxPrice=abc&sort=weird&direction=sideways` → defaults, never an error page → AC-2
- [ ] With more than 20 listings, press Load more → the list grows from the top through the next page, and the last page says there is nothing more → AC-3
- [ ] Visit `/?platform=instagram&maxPrice=1` → empty state with a Clear filters way out → AC-11
- [ ] Sign in as a buyer and press Claim and open WhatsApp → one claim, then the WhatsApp chat opens with `Hello! I am <display name> and I would like to buy "<title>" (<slug>) listed at <price>.` → AC-6
- [ ] Press the button twice fast, or claim from two buyers at once → exactly one lands in chat, the other sees Just taken → AC-6, AC-7
- [ ] After a claim, reload `/` → that listing is gone from the cards → AC-7, AC-8
- [ ] Open a claimed listing as a different signed in buyer, and as an anonymous visitor → not found, never the detail → AC-8
- [ ] Open a listing you hold → the WhatsApp link is offered again, no claim button → AC-6
- [ ] Claim five times inside an hour from one address → the wait message with the sign in nudge → AC-10
- [ ] Sign in as the owner and press claim → refused, never a claim → AC-8
- [ ] Open a sold listing inside the window → Sold badge on its card, sold banner on detail, and the sold panel replaces the claim button → AC-9
- [ ] Set `sold_at` to more than 7 days ago on that listing → it drops off the cards on its own → AC-9
- [ ] Tab from the top of `/` → the skip link appears first, then brand, then every control in order, with a visible focus ring on each → AC-1
- [ ] Check every filter control has a visible label and a 44px or taller target → AC-2
- [ ] View the page source of `/` and `/listings/<slug>` → `noindex, nofollow`, and no sitemap file exists → AC-12
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build` → all pass, lint clean apart from the three `<img>` warnings → all

## Commands

- [ ] `npm run typecheck` → no errors → all
- [ ] `npm run build` → compiled, both routes prerendered as partial prerender, no prerender warnings → all
- [ ] `npx dotenv -e .env.local -- npx tsx <claim script>` → first claim ok, same buyer again `already-holds-this-listing`, second listing `already-has-pending-claim`, other buyer on the taken one `listing-taken`, owner `owner-cannot-claim`, fifth attempt from one hash `rate-limited` → AC-6, AC-7, AC-10
- [ ] Query `rate_limit_clicks` after five attempts → the count for that visitor hash and hour bucket is 5, no raw address stored → AC-10
- [ ] Query `listings` for a claimed slug → `status` is `pending`, `claimed_by_user_id` and `claim_token` and `pending_since` are set → AC-6
- [ ] Query `information_schema.columns` for `users` → `display_name` present, and the session read raises no schema mismatch → AC-4

## Value sourcing checks

- [ ] Card price → change `price_amount` to a value with a thousands separator and confirm the card and detail both show the Naira formatter output → AC-1, AC-4
- [ ] Card follower count → confirm it shows the raw number, never a compacted form such as 185K → AC-1
- [ ] Account age → set `account_age_months` to 34 and confirm the card and detail both read 2y 10m → AC-1, AC-4
- [ ] Cover image → set `listing_images` for position 0 width 768 and confirm the card uses it, then remove it and confirm the neutral placeholder block appears → AC-1
- [ ] Gallery → give a screenshot all three widths and confirm the browser picks 320 on a narrow screen and 768 or 1200 on a wide one → AC-4
- [ ] Empty description → set `description` to null and confirm the About block renders nothing → AC-4
- [ ] Sold window → set `sold_at` to exactly 7 days ago and to 8 days ago and confirm the first still shows and the second does not → AC-9
- [ ] Chat message → claim as a buyer whose `display_name` is set and confirm the message uses it, not the email → AC-6
- [ ] Chat link → confirm it starts with `https://wa.me/` and the seller number from `SELLER_WHATSAPP_NUMBER`, and that the number appears nowhere else in the page → AC-6
- [ ] Sign in return → open a detail page anonymously, press the prompt, sign in, confirm you land back on the same listing → AC-5
- [ ] Cursor → page through with `sort=price&direction=asc` and confirm the pages do not overlap or skip a row when two listings share a price → AC-3
- [ ] Timezone → the sold window and the hourly bucket both use UTC, so confirm the hour bucket rolls at 00:00 UTC and not at local midnight → AC-9, AC-10

## Acceptance criteria coverage

- AC-1 covered by the anonymous grid step, the raw follower step, the age step and the cover image step
- AC-2 covered by the Apply filters step, the shared link step, the bad values step and the labelled controls step
- AC-3 covered by the Load more step and the cursor overlap step
- AC-4 covered by the signed in detail step, the empty description step and the gallery step
- AC-5 covered by the anonymous detail step and the sign in return step
- AC-6 covered by the happy claim step, the double press step, the claim row query and the display name step
- AC-7 covered by the double press step, the cards after claim step and the taken state step
- AC-8 covered by the other buyer step, the owner claim step and the claimed row query
- AC-9 covered by the sold detail step, the drop off step and the sold window boundary step
- AC-10 covered by the five attempts step, the counter query and the UTC hour bucket step
- AC-11 covered by the empty state step
- AC-12 covered by the noindex step

## Known gaps to close outside this feature

- `/sign-in` does not exist yet. The prompt points at it, so that link 404s until the owner sign in feature lands.
- `SELLER_WHATSAPP_NUMBER` must be in Vercel before the claim button works in production.
- The sign up and sign in pages, the seller role seeding and the upload pipeline belong to feature 6 and spec 0002.
