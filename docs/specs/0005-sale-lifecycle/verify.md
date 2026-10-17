# Verify: Sale lifecycle: pending, sold, removal · spec 0005 · updated 2026-10-16
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Sign in as a buyer, claim one available listing from `/listings/<slug>` → the card leaves `/` and the grid count drops → AC-1
- [x] As that buyer, open the same slug again → the detail loads with a hold banner and a button back to WhatsApp chat, no claim button → AC-1
- [x] Sign in as a second buyer, open that same slug → reads as not found with a "Browse accounts" link, never a hint that it is merely held → AC-1, AC-5
- [x] Open `/admin?status=pending` as owner, press **Sold** on a pending row → the row flips to sold, `Sold on <date>` appears, the holder name stays on the row → AC-2
- [x] Press **Reopen** on that sold row → status back to available, the sold date is gone, the holder name is gone → AC-4
- [x] With a pending row, press **Release** → the listing returns to the `/` cards and the holder, token and pending age all disappear → AC-3
- [x] With an available row, press **Mark sold** → status sold, a sold date appears, no holder is named → AC-4
- [x] Open `/` as a visitor → the sold listing shows a Sold badge, and opening its detail shows the sold banner → AC-5
- [x] Set one sold listing's `sold_at` to 8 days ago (see Commands) → it leaves the `/` cards, and its detail reads as not found with a way back to browse → AC-5
- [x] Set one sold listing's `sold_at` to exactly 7 days ago → it still shows on the cards, confirming the window edge is inclusive → AC-5
- [x] Sign in as a customer, press **Sold** on any panel row (the buttons are not there, so call the action directly, see Commands) → refused, nothing changes → AC-7
- [x] Check the holder name in the panel and on the holder own detail page → present in both, absent from `/` and from any public page → AC-7
- [x] Two browser tabs on `/admin?status=pending`, press **Sold** on the same row in both → one wins, the other says the listing just changed and the table shows the true state → AC-6
- [x] Tick two pending rows and press **Confirm selected** → both move to sold, the bar reports the count → AC-8
- [x] Tick three rows where one is already sold, press **Release selected** → the two pendings release, the bad row is reported as skipped and never blocks the rest → AC-8
- [x] Tick nothing and press **Confirm selected** → a clear "Pick at least one listing first" message, nothing moves → AC-8
- [x] Open `/admin?status=pending` with no claims → "No pending claims"; open `/admin?status=sold` with no sales → "No recent sales" → AC-8
- [x] Keyboard only on `/admin` with a pending row → tick box, **Sold** and **Release** are reachable in order with a visible focus ring, the button keeps focus while the move runs, and the result message is announced → AC-8
- [x] Two buyers claim the same listing at the same moment (two tabs, same account) → exactly one holds it, the other gets the "already taken" refusal with a way back to browse → AC-10

## Commands
- [x] `npm run typecheck` → green → all
- [x] `npm run lint` → 0 errors → all
- [x] `npm run build` → all ten routes compile, `/listings/[slug]` still partial prerender with the new not found body → all
- [x] `SELECT status, claimed_by_user_id, claim_token, pending_since, sold_at FROM listings WHERE id = <id>;` after each move → the four columns match the spec's transition table: confirm sets `sold_at` and keeps the holder, release nulls holder, token and `pending_since`, reopen additionally nulls `sold_at` → AC-2, AC-3, AC-4
- [x] `UPDATE listings SET deleted_at = now() WHERE id = <id>;` then press any move → refused as not found, never a partial write → all four moves
- [x] `UPDATE listings SET sold_at = now() - interval '8 days' WHERE id = <id>;` → drops from cards and detail → AC-5
- [x] `UPDATE listings SET sold_at = now() - interval '7 days' WHERE id = <id>;` → still visible, the edge is inclusive → AC-5
- [x] Watch the app log while pressing any move → one `listing.transition` line with the listing id, the old state, the new state and the actor id → AC-9
- [x] Send a bulk press of more than 50 ids → refused whole with "more than 50 listings", nothing moves → AC-8
- [x] Send a bulk press with the same id repeated → the row moves once, the result list names it once → AC-8

## Value sourcing
Each step exercises where one value comes from, so a mis sourced value shows up as a wrong output.

- [x] `sold_at` after confirm → set from the database clock, not from the browser: press confirm, then compare `sold_at` to `SELECT now()` on the server. Change the browser clock or the machine timezone first and confirm the stamp does not move → AC-2
- [x] The 7 day window cutoff → `soldWindowCutoff` in `src/features/listings/domain/visibility.ts`: set `sold_at` to 6 days 23 hours ago (expect still visible) and to 7 days 1 hour ago (expect gone) → AC-5
- [ ] Server timezone → run the cutoff check with the database session on a non UTC `TimeZone` and with the app on a non UTC `TZ`, and confirm cards and detail still agree, since `sold_at` is a `timestamp without time zone` → AC-5
- [ ] Holder name → `users.display_name` joined at read time with the `Buyer` fallback: delete the holder's user row is not possible while the FK holds, so instead confirm a null `display_name` renders as `Buyer` on the panel row → AC-7
- [x] Pending age and sold date on panel rows → `pending_since` and `sold_at` through the panel's own formatters, no second query per row → AC-8
- [x] Bulk result counts → `moved` equals the number of rows whose conditional write returned a row, `skipped` equals the rest, verified against the row states after the press → AC-8
- [x] Chat link on the hold banner → the spec 0003 chat link builder: open the hold banner as the holder and confirm the link opens WhatsApp with the listing named → AC-1

## Acceptance-criteria coverage
- AC-1 covered by the claim, hold banner and second buyer steps · AC-2 covered by the confirm steps plus the `sold_at` column check · AC-3 covered by the release steps plus the column check · AC-4 covered by the direct sold and reopen steps · AC-5 covered by the badge, banner, expiry, window edge and not found steps · AC-6 covered by the two tab race step · AC-7 covered by the customer refusal and holder visibility steps · AC-8 covered by the bulk, empty state and keyboard steps · AC-9 covered by the app log step · AC-10 covered by the simultaneous claim step
