# 0003 rationale · Storefront browse and WhatsApp handoff

The decision record for [index.md](index.md). Reasoning, options and references; not build input.

## Context

> ⚠️ Premise note: the engineer chose claim plus chat in one click for this slice. That pulls the atomic claim write forward out of the sale lifecycle feature and the data model claim milestone. Those still own the pending release and sold confirmation. This spec assumes the claim use case and its rate limit exist before the button is built, and the build plan orders it second for that reason.

The shop earns trust on a phone. Most buyers arrive from a shared link on mobile data, see a grid of accounts, and decide in seconds whether to tap through. The pages must read live from the database so a price just changed is live at once, and they must stay out of search results since the inventory is not meant to be indexed. The valuable content, the full account detail, sits behind a buyer sign in, while the cards stay public and light. The one action that matters ends in WhatsApp, where the real deal happens, so the handoff message must name the exact account and price without the buyer typing anything.

## Options considered

### Option 1: Server rendered pages with one combined claim button

Home grid and detail are server components reading live through the read use cases. Filters, sort and the cursor travel in the URL. Load more is a plain link carrying the next cursor, so every page is shareable with no client fetching code. The detail button is a server action that runs the atomic claim, then redirects to the seller chat link. Recommended.

**Pros**:
- Matches the stack already decided, no fetching library and no extra API routes.
- Every view is a link, so sharing and the back button behave.
- One tap from decision to chat, kindest on mobile.

**Cons**:
- Load more does a full page render instead of an instant append.
- The button needs the claim path built in this slice, not later.

### Option 2: Client side infinite scroll with separate claim and chat steps

The grid hydrates and appends pages through client fetching, and claiming and chatting are two distinct buttons pressed in order.

**Pros**:
- Smoother scrolling feel on fast phones.
- Each step states its own result before the next begins.

**Cons**:
- Needs client fetching code plus JSON routes the stack decision ruled out.
- Two taps where buyers expect one, and an extra pending state to explain.

### Option 3: Chat link only, claim deferred to the sale lifecycle feature

The button opens WhatsApp with no write, and the pending claim arrives later with the sale lifecycle work.

**Pros**:
- Smallest slice, no auth or writes on the button at all.
- Nothing can half claim.

**Cons**:
- Two buyers can chase one account with no record of who holds it.
- Contradicts the one buyer per listing rule the data model was built for.

## Rationale

The forces are a phone on mobile data, links shared into chats, and one seller who needs to know who wants which account. Server rendering keeps cards fast and shareable with no fetching machinery, and the URL carried filters mean a buyer can send a narrowed view to a friend. The combined button follows the engineer choice and the one buyer rule: the click that starts the deal is the click that records who holds the account, so two simultaneous buyers cannot both walk away believing it is theirs. The runner up, separate claim then chat steps, is clearer per step but costs a tap and a state the shop must then display everywhere.
