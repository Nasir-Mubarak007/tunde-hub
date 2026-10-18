# Rationale: 0006. Error monitoring

## Context

A thrown failure in this shop currently reaches nobody. The transition log prints one line per sale move to the standard output and nothing else is recorded anywhere, so a database write that throws, an upload that fails, or a bug in a component leaves no trace once the request ends. On a shop where the owner is also the developer, that means the first report of a broken page is a buyer saying so on WhatsApp.

The forces shaping this decision:

* **The project already promises this and does not do it.** Root `AGENTS.md` lists Sentry as a key dependency and rules that only truly unexpected failures throw and reach Sentry. The `Result` pattern in `src/core/result.ts` already keeps domain refusals as values, so the throwing surface is small and well defined. The gap is the reporting half, not the error half.
* **Stack traces are the whole point.** A minified bundle name is not actionable. Source map upload at build time is what turns a trace into `adminList.tsx:239`.
* **One person operates this.** Every moving part has to be operable on a Tuesday evening with no runbook. A self hosted monitor is a service to upgrade and a place to host, which is a poor trade for a single maintainer.
* **Buyer personal data is in scope.** Email addresses, display names and the seller WhatsApp number flow through this app. Anything that reports must be able to keep them inside.
* **Deployment is Vercel.** Scheduled jobs and the monitor's build integration both come from that, and on the cheapest Vercel plan a scheduled job can only run once a day, which is why a daily cadence is the one in the spec rather than an hourly one.

## Options considered

### Option 1: Hosted monitor only

Send failures to Sentry and nothing else. No local tables, no extra write path.

**Pros**:
* Least to build and least to operate. One destination, one dashboard.
* The free tier is comfortable for a shop this size, so cost is not a real constraint.
* Alerts and issue grouping are the vendor's problem, not yours.

**Cons**:
* Every question about a failure needs the vendor's UI, and SQL cannot answer anything.
* The database stays unaware that anything went wrong, so a failure is only visible while the subscription is live and the project is reachable.

### Option 2: Hosted monitor plus two local tables (chosen)

Everything in Option 1, plus every failure and every slow request written to your own Postgres, through a port the domain declares.

**Pros**:
* Failures become queryable: "which routes failed last week", "how many failures on the claim path", all answerable in SQL against tables you own.
* The local copy survives any vendor outage or billing change.
* The write goes through the project's existing port convention, so no `domain` or `application` file learns about the SDK.

**Cons**:
* Two copies of the same failure can disagree if the local write fails silently, so the write must be best effort and the monitor stays the source of truth.
* Two retention jobs, or one job doing both, which is a small ongoing responsibility.
* More code for a problem that the vendor already solves, which is the price of not depending on it.

### Option 3: Self hosted monitor

The same software on infrastructure you control.

**Pros**:
* No vendor, no quota, no per event cost at any volume.
* The data never leaves infrastructure you own.

**Cons**:
* You run it, upgrade it, back it up and page yourself when it is down, which is a second product.
* Source map upload still needs the same tokens and the same build wiring, so the build complexity is identical for none of the operational savings.

### Option 4: Structured logs into your own database only

No third party. Every failure becomes a row, and the owner reads them in SQL.

**Pros**:
* No new dependency, no new account, no data leaving the shop at all.
* Total control over the shape and the retention.

**Cons**:
* No grouping, no alerting, no deduplication, no session context. You would build those before the first useful alert exists.
* Browser errors are not captured at all without an SDK.

## Rationale

The engineer chose the hosted monitor plus local tables, and that is the right call here for one specific reason: the local copy is the one you will actually query. The shop's failure surface is small and mostly server side, but the questions worth asking are historical ("did the claim path fail repeatedly last Tuesday"), and SQL answers those while a dashboard does not. The monitor's job is the alert and the readable trace, the tables' job is a rolling thirty day window of the same events, which is worth knowing before anyone relies on them as a record past that point.

Against the alternative of a single destination, the cost is one best effort write per event behind a port that already exists as a pattern in this codebase (`TransitionLog`, `RateLimitStore`, `ListingSaleStore`). That is not new architecture, it is the architecture the project already chose, applied to a new destination.

Three recommendations were settled rather than asked. **Source maps upload at build time, not at runtime**: without it the traces are unreadable, which defeats the feature's purpose. **Only production reports**: sending preview and local noise into the production project is how an error tool starts being ignored. **The two new tables use `timestamp with time zone` while the older tables do not**: spec 0005's review flagged the naive columns, and a new migration should not propagate a known flaw, so the schema now holds both shapes until a later migration settles it.

Two choices from the conversation deserve their tradeoff named. The engineer chose browser capture, which adds the SDK to the client bundle on a shop aimed at phones, and chose to mirror every sale move as a breadcrumb, which couples ordinary panel work to the monitor. The breadcrumb cost is close to zero, because the monitor discards breadcrumbs when no event fires, so it only rides along with a failure that already happened. Browser capture is a real page weight cost that buys the errors a buyer actually hits, which is a defensible trade for this product.

> Premise note: this spec and spec 0009 both need a scheduled job, and a project with two `vercel.json` files fighting over one schedule is a known way to lose a prune silently. This spec owns the `crons` entry outright, at `0 6 * * *`, and spec 0009 must reuse it rather than define a second one.

Two corrections came out of the cross check pass and are worth recording, because both were wrong in the first draft. **The local row must be written from the before send stage, not an after send callback.** An after send callback never fires when the vendor is unreachable, which is exactly the outage the design has to survive, so the obvious wiring would have produced no local record during the one failure it was needed for. **An app that is down cannot report that it is down.** The daily ping only proves the app booted and the route ran, so catching a dead app needs an uptime monitor in the vendor's own settings, which is why it is a prerequisite in the spec rather than a claim in its benefits.

## References

References were not requested for this decision, so the record stays clean. The reasoning above is self contained.