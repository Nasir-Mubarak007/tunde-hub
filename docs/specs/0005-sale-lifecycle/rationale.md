# Rationale for 0005. Sale lifecycle for listings

## Context

The shop already claims atomically and already hides pending rows. Spec 0002 stores status plus holder plus two timestamps and stops double holds at the database. Spec 0003 turns a claim into a chat handoff and shows sold rows briefly. The panel from feature 6 lists rows with holder and dates but cannot yet end a claim.

What is missing is the ending. After the chat starts on WhatsApp, the listing sits in pending with no owned way out. The owner needs a confirm path for a paid deal and a release path for a dead chat, plus a direct sold path for deals that never touched the claim button and a reopen path for mistakes. The sold proof window also needs an owner: 7 days was penciled in as a placeholder and feature 7 must fix it.

The forces are small scale and low ceremony. One owner, a handful of listings, chat led sales, phone first buyers. Anything with a scheduler or a ledger would outweigh the job. The design must keep the safety rule whole while adding the smallest ending that a busy seller can run from the panel.

## Options considered

### Option 1: Owner actions over the existing row plus expiry by query filter

Four single moves plus two bulk moves, each a conditional write on the expected state, over the spec 0002 row. Public reads filter sold rows by sold at inside 7 days. No job, no new table, no new column.

**Pros**:
* Smallest moving set: no scheduler to watch and no ledger to keep true.
* Safety stays where it is: the atomic claim plus the partial unique index keep guarding holds.

**Cons**:
* Bulk moves add weight a one person shop may rarely use.
* Per listing windows and rich history need later work.

### Option 2: Nightly cleanup job that retires expired sold rows

Same owner moves, plus a scheduled job that soft deletes sold rows once they pass the window.

**Pros**:
* Reads stay simple: expired rows are gone so no window math at read time.
* The table stays lean over time.

**Cons**:
* A scheduler is a new watcher: failures hide listings late or early with no eyes on them.
* Timing drifts: expiry lands on job ticks, not on the true 7 day mark.

### Option 3: Database scheduled task that flips rows in place

Same owner moves, plus a database task that updates rows past the window.

**Pros**:
* No app worker: the database owns the clock.

**Cons**:
* Hardest to observe from the app: retries and logs live outside the codebase.
* Couples the shop to one database feature for a rule a query filter already expresses.

## Rationale

Option 1 fits the forces. The shop is chat led and owner run, so the ending should be four plain presses plus bulk for busy days, all guarded by expected state writes. Expiry is a display rule, not a data deletion, so a sold at window at read time is truer than a job that rewrites rows. The fixed 7 day constant keeps the call the engineer already made in code (`SOLD_WINDOW_DAYS`) and the holder name stays a join at read time so no stored copy can go stale. Bulk made the cut because the engineer asked for both single and bulk in the panel, even at the cost of extra weight.
