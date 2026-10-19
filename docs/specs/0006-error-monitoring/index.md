# 0006. Error monitoring with readable stack traces and a local failure record

**Date**: 2026-10-17
**Status**: In Progress

## Summary

Until now a thrown failure in this shop reaches nobody: it prints in the server log and is gone. This spec wires a hosted error monitor (Sentry) so any unexpected failure on the server or in a buyer's browser arrives with a stack trace that names your real file and line, and it writes the failures and slow requests to two tables in your own database so you can query them in SQL. It also mirrors every sale move into the monitor as context, and adds a daily scheduled job that pings the monitor and deletes rows older than thirty days. Nothing about the shop's own rules changes: domain refusals stay values and never leave the app.

## Requirements

**User stories**:
* As the owner, I want to hear about a failure when it happens, so I learn about a broken shop from the monitor instead of from a buyer.
* As the owner, I want a stack trace that names the real file and line, so I can fix the failure without reading minified bundle names.
* As the owner, I want failures and slow requests in my own database too, so I can ask questions of them in SQL and read them without a subscription.
* As the owner, I want buyer personal data to stay inside the shop, so no email address, display name or phone number is ever handed to a third party.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
* **AC-1**: An unexpected thrown failure on any server page, server action or browser page reaches the monitor as an issue whose stack trace names the real source file and line, for server and browser code alike.
* **AC-2**: Domain refusals, which are the `Result` values the shop already returns instead of throwing, never reach the monitor, and that pattern is unchanged by this feature.
* **AC-3**: No request body, cookie or request header ever leaves the app, and email addresses, display names and phone numbers are scrubbed out of messages, stacks and urls before anything is sent or stored. The same scrubbed text is what reaches both destinations.
* **AC-4**: Every captured failure also lands in an error rows table, and every slow request in a performance rows table, both written through a port declared in the domain, and both carrying the monitor's event id so a row can be jumped to from the monitor. The local row is written whether or not the event reaches the monitor, so a monitor outage loses nothing locally.
* **AC-5**: A request slower than three seconds is recorded as a slow request on the server and in the browser, and nothing faster than that is.
* **AC-6**: Every sale lifecycle transition is mirrored into the monitor as a breadcrumb, while the one app log line per move that spec 0005 requires stays exactly as it is.
* **AC-7**: A daily scheduled job pings the monitor from the deployed app, guarded by `CRON_SECRET`, and the same job deletes error and performance rows older than thirty days.
* **AC-8**: A monitor outage, a rejected upload or a failed database write changes no response and breaks no page, and a local write failure is swallowed the way the transition log already swallows its own.
* **AC-9**: Only production reports, and only production writes the local tables. Local runs and preview deployments stay silent and write nothing, unless preview reporting is switched on with a separate preview DSN, and the environment name reaches the monitor so production and preview are never confused.
* **AC-10**: Every build uploads its source maps, and a failed upload prints a warning without failing the build.

## Decision

**Chosen option**: Option 2: hosted monitor plus two local tables, wired through the project's own ports.

Source maps upload at build time, the SDK is initialised in the framework's own instrumentation hooks, and the local write goes through a port declared in a new `observability` feature area so no `domain` or `application` file ever imports the SDK.

**Implementation skills**: `sentry-nextjs-sdk` (`getsentry/sentry-for-ai`, `.agents/skills/sentry-nextjs-sdk/`) · `sentry-fix-stack-traces` (`getsentry/sentry-for-ai`, `.agents/skills/sentry-fix-stack-traces/`)

## Feature design

**Data model sketch**:

Two tables, both new, both written only by the observability adapter. Only the database ever stamps a row: `occurred_at` is a `timestamp with time zone` column with a default of `now()`, and no port signature carries a timestamp. Both column types are spelled out in full here and deliberately differ from the older naive columns in spec 0002 (see Consequences).

```
error_events
  id                bigint identity, primary key
  kind              error_kind enum  not null   'unhandled' when nothing handled the throw,
                                                 'captured' when the app called the recorder,
                                                 'client-reported' for a server action failure
                                                 the browser saw
  message           text        not null   scrubbed before storage
  stack             text        null       scrubbed before storage
  route             text        not null   route template, never a raw url; the owned
                                         ROUTE_UNKNOWN constant when there is none
  side              capture_side enum not null   'server' or 'browser'
  sentry_event_id   text        null       null when the event was never sent
  occurred_at       timestamp with time zone not null, default now()
  indexes           (occurred_at) for the daily prune, (route, occurred_at) for reads

slow_requests
  id                bigint identity, primary key
  method            text        null       null for a browser route change, which has no method
  route             text        not null   route template, ROUTE_UNKNOWN when there is none
  duration_ms       integer     not null
  side              capture_side enum not null
  sentry_event_id   text        null
  occurred_at       timestamp with time zone not null, default now()
  indexes           (occurred_at) for the daily prune, (route, occurred_at) for reads
```

No foreign keys. Nothing else in the schema references either table, and neither is read by any page in this slice; the owner reads them in SQL or through the monitor.

**State transitions**: none. Both tables are append only and rows are deleted by age.

**Scrub** (the one rule that makes AC-3 real):

* One pure function `scrubText` in `src/features/observability/application/scrub.ts`. Takes a string, returns the string with email addresses and runs of eight or more digits replaced by a placeholder. No state, no clock, no database, so it is trivially testable.
* It runs at three call sites: the monitor's before send hook, its before send transaction hook, and the adapter that writes the local row. Both destinations therefore receive the same scrubbed text.
* Personal names, display names and phone numbers stay inside because the context is never attached in the first place: `sendDefaultPii: false`, no request body, no cookies, no headers, no query string, and no user context object anywhere in the app. Text scrubbing is a second line of defence, not the mechanism, and the spec does not claim a regex could remove a name.

**Instrumentation hooks** (the exact entry points, since AC-1's server half fails without them):

* `src/instrumentation.ts` exporting `register()` for both the Node.js and the edge runtime, plus the framework's `onRequestError` export, which is what turns a server render or server action failure into a captured event. Without `onRequestError` nothing server side is ever captured.
* `src/instrumentation-client.ts` for the browser.

**API surface**:

| Endpoint or port | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `FailureRecorder.recordFailure` | port call from the adapter, inside the before send hook | `message`, `stack`, `route`, `side`, `kind`, `sentryEventId` | `Result<void, "observability-storage-failed">`, deliberately ignored by the adapter | internal only | a storage failure is a value, never a throw, and never reaches a response |
| `FailureRecorder.recordSlowRequest` | port call from the adapter, inside the before send transaction hook | `method`, `route`, `durationMs`, `side`, `sentryEventId` | `Result<void, "observability-storage-failed">`, deliberately ignored | internal only | as above |
| `FailureRecorder.pruneOlderThan` | port call from the daily job, no arguments | none | rows deleted | internal only | the one method that throws a storage error, because a job must see its own failure |
| `BreadcrumbSink.recordTransition` | port the listings transition adapter calls | the existing transition entry | nothing | internal only | swallows its own failure, like every other log sink here |
| `/api/cron/health` | GET, `dynamic = "force-dynamic"` | `Authorization: Bearer <CRON_SECRET>` | `200 {"ok":true,"pinged":true,"pruned":{"errorEvents":n,"slowRequests":m}}` | the bearer secret only, compared in constant time, no other credential accepted | `401 {"error":"unauthorized"}` when the header is missing or wrong |
| `GET /`, `/listings/[slug]`, `/admin` and every action | existing | existing | existing responses, unchanged | existing | unchanged |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| failure record | `route` | the App Router route template on the server; on the browser, the pathname with its dynamic segments replaced by the framework's bracket form, using one owned rule so a slug never reaches either destination |
| failure record | `route` when there is none | owned constant `ROUTE_UNKNOWN` in `src/features/observability/domain/constants.ts` |
| failure record | `side` | which hook captured it, the server or the browser |
| failure record | `kind` | the hook that produced it: the unhandled error hook, an explicit recorder call, or the browser reporting a server action failure |
| failure record | `message` and `stack` | the thrown error, passed through `scrubText` before it is sent or stored |
| failure record | `occurred_at` | database clock `now()`, the column default, matching the sale store's rule that only the database stamps a row |
| failure record | `sentry_event_id` | the id already present on the event in the before send hook, null when the event was never sent |
| slow request record | `method` | the request method on the server, null on the browser where a route change has none |
| slow request record | `route` and `duration_ms` | the transaction name from the same routing rule as the failure record, and the monitor's measured transaction duration, never a client clock |
| slow request capture | the three second threshold | owned constant `SLOW_REQUEST_MS` in `src/features/observability/domain/constants.ts`, next to the existing rate limit constants |
| slow request capture | traces sample rate | `SENTRY_TRACES_SAMPLE_RATE`, default `1`, so that every slow request becomes a transaction and the threshold does the filtering rather than the sampler. Errors are never sampled. Lower it only if event volume ever justifies it. |
| breadcrumbs | the transition | the existing `TransitionLog` entry, via the `BreadcrumbSink` port, so the mirror cannot invent a state the app did not write |
| daily job | the schedule | `vercel.json`, `"crons": [{"path":"/api/cron/health","schedule":"0 6 * * *"}]`, owned by this spec; spec 0009 reuses this entry rather than adding a second one |
| daily job | auth | env var `CRON_SECRET`, compared against the `Authorization` header in constant time |
| daily job | the retention cutoff | computed inside the delete statement as `now() - make_interval(days => 30)`, from owned constant `RETENTION_DAYS`, so no app clock reaches a row |
| daily job | the ping | one message event naming the app and the environment, no local row |
| environment | the monitor's environment name | env var `SENTRY_ENVIRONMENT`, defaulted from `VERCEL_ENV` on the server |
| environment | whether anything reports at all | `enabled` is `NODE_ENV === "production"`, or production plus preview only when `SENTRY_SEND_IN_PREVIEW === "true"` with a separate preview DSN. The same gate guards the local write, so a preview run cannot fill the tables. |

**Key invariants**:
* The monitor can never change a response. Capture is wrapped, and a failure inside the SDK is swallowed exactly like `appTransitionLog` swallows its own.
* The local row is written from the before send stage, never from an after send callback, so a monitor outage still leaves the local record. This is the single load bearing detail of the whole design.
* `domain` and `application` never import the SDK. Only the infrastructure adapter and the two instrumentation files may.
* Nothing leaves the app unscrubbed, and the local tables store the same scrubbed text the monitor receives, so the database is not a leak path the monitor is not.
* Request bodies, cookies, headers and query strings never leave the app, in either direction, and no user context object is ever attached.
* No `domain` or `application` file constructs a `Date` for a stored row. Every row's timestamp is the database clock.
* A stored row is at most thirty days old, because the daily job deletes anything older.
* A build never fails because a source map upload failed.
* The local tables are written only when reporting is enabled, so a local or preview run leaves them empty.
* Breadcrumbs cost nothing on their own, because the monitor discards them when no event fires, so mirroring every move does not consume quota by itself.

**Security model**:

Only the owner reads anything here, through their own monitor account or through SQL. No page reads either table in this slice. Data that leaves the app: a scrubbed message, a scrubbed stack, a route template, the side, the environment, and optional tags the caller sets deliberately (a listing id, a role). Data that never leaves: buyer email addresses, display names, phone numbers, the seller WhatsApp number, request bodies, cookies, headers, query strings, the claim token, the database url, and the auth secret. No compliance scope beyond the existing account data, matching spec 0005's framing. Prerequisites before the build can work: a monitor project with its DSN, auth token, organisation and project values in the environment, and an uptime or cron monitor created in the monitor's own settings, because an app that is down cannot report that it is down.

**Configuration required**:
* `SENTRY_DSN`: the project the runtime sends events to. Read through a lenient reader of its own, never through `src/core/env.ts`, because `instrumentation.ts` runs at boot and the strict validator would fail a local boot where the value is absent.
* `SENTRY_AUTH_TOKEN`: the build time token that uploads source maps.
* `SENTRY_ORG` and `SENTRY_PROJECT`: which project the build uploads to.
* `SENTRY_RELEASE`: the release name source map uploads attach to, defaulted from `VERCEL_GIT_COMMIT_SHA` so a trace names the commit that produced it.
* `SENTRY_ENVIRONMENT`: the name the monitor files events under, defaulted from `VERCEL_ENV` on the server.
* `SENTRY_TRACES_SAMPLE_RATE`: share of performance transactions kept, default `1` so the slow request threshold is the only filter.
* `SENTRY_SEND_IN_PREVIEW`: set to `true` to report from preview deployments, which then need their own preview DSN.
* `CRON_SECRET`: guards the daily job route.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
* Happy path: throw inside a server action in production, and the monitor shows an issue with a real file and line, the error table has the row, and a matching row appears for a slow request, verifies **AC-1**, **AC-4**, **AC-5**
* Happy path: break a component in the browser and the monitor shows it with a browser stack trace and a browser route, verifies **AC-1**
* Value sourcing: confirm the stored route is the template and not a url carrying a slug, and that `occurred_at` matches the database clock, verifies **AC-3**, **AC-4**
* Failure case: make the monitor reject every event and make the local insert fail, then load every page and press every action, and confirm no response changes, nothing throws, and a local row still exists for the refused event, verifies **AC-4**, **AC-8**
* Failure case: call the daily route with a wrong secret, then with the right one, verifies **AC-7**
* Auth/permission: confirm a buyer, and an anonymous visitor, cannot reach the daily route, that local and preview runs send nothing and write no rows, verifies **AC-7**, **AC-9**
* Edge case: press confirm on a pending row, fail the page immediately after, and confirm the monitor's context carries the move that preceded it, verifies **AC-6**
* Edge case: trigger a route change in the browser to a listing url and confirm the stored route is the template with no slug in it, verifies **AC-3**
* Edge case: fail a build time source map upload, verifies **AC-10**
* Edge case: fire a domain refusal such as pressing Release on an already available row, and confirm nothing reaches either destination, verifies **AC-2**

## Build plan

Ordered by the project's Skateboard approach: the thinnest usable whole first, one failure captured and readable end to end, then the wider capture the engineer chose.

1. [x] Add the two tables to the schema with their enums, nullable columns and time zone timestamps, and one migration, satisfies **AC-4**, **AC-7**
2. [x] Create `src/features/observability/` with the `FailureRecorder` and `BreadcrumbSink` ports, the owned constants `SLOW_REQUEST_MS`, `RETENTION_DAYS` and `ROUTE_UNKNOWN`, and the Drizzle implementation behind them, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**
3. [x] Install the SDK, add `src/instrumentation.ts` with `register()` and `onRequestError` plus `src/instrumentation-client.ts`, the pure `scrubText`, the reporting gate and the lenient env reader, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-9**
4. [x] Wrap the config with the monitor's build plugin, add the release name from the commit sha, and add a build script that uploads source maps after a successful build, warning and exiting zero on failure, with a `.sentryclignore`, satisfies **AC-1**, **AC-10**
5. [x] Write the adapter that turns an event into a scrubbed local row from the before send stage, so the row survives a refused send, satisfying **AC-3**, **AC-4**, **AC-8**
6. [x] Mirror the transition through the existing listings log adapter into the breadcrumb port, leaving the app log line untouched, satisfies **AC-6**
7. [x] Capture slow requests on the server and in the browser against the owned threshold, with the trace sample rate at 1, satisfies **AC-5**, **AC-9**
8. [x] Add the guarded daily route with its status bodies, the ping, and the database clock prune, and the `vercel.json` entry that owns the schedule, satisfies **AC-7**
9. [x] Prove the isolation: a failing SDK and a failing insert cannot reach a response, and a domain refusal captures nothing, satisfies **AC-2**, **AC-8**

Two build time facts the SDK version decided, not this spec: the SDK no longer has `sendDefaultPii`, so the promise is kept with `dataCollection` switched off category by category, and the slow request threshold is judged in `beforeSendSpan` rather than `beforeSendTransaction`, which the SDK no longer calls under its default trace lifecycle. A browser cannot reach the database, so browser captures are scrubbed and sent but write no local row; the two record methods are also async, because an insert cannot be awaited by a synchronous signature.

## Consequences

**Positive**:
* A broken shop tells you, on the server and in a buyer's browser, with a file and line you can act on.
* Failures and slow requests become queryable in your own database, with no subscription in the way, over a rolling thirty day window.
* The sale loop gains context: a failure shows the moves that came before it.
* An outage monitor configured in the vendor's settings is what actually catches a dead app, and this spec makes that a prerequisite rather than a hope.

**Negative / tradeoffs**:
* Two places hold the same failure, so a disagreement between them is possible and the local copy is the one you query.
* Browser capture adds the SDK to the client bundle, which costs a little page weight on a shop aimed at phones.
* The choice to mirror every move couples the panel's ordinary work to the monitor, kept honest only by the fact that breadcrumbs are discarded unless an event fires.
* A daily cadence is the only one available on the cheapest Vercel plan, so the vendor side of the health signal is up to a day old.
* The two new tables use `timestamp with time zone` while the existing tables use `timestamp` without it, so the schema now holds both shapes.
* This is four things for one maintainer to keep alive: a vendor account, two tables, a client SDK, and a schedule.

**Neutral**:
* Existing files that change beyond the new area: `next.config.ts`, `package.json`, `.env.example`, the schema file, and the listings transition log adapter, which gains a breadcrumb call.
* The daily schedule is owned here, in `vercel.json`, and spec 0009's retention prune reuses that entry.
* The Sentry SDK becomes a runtime dependency on both the server and the client.
* The alert on each new issue is configured in the monitor's own settings, not in code.
* Root `AGENTS.md` currently lists Sentry as a dependency and rules that failures reach it. Both statements become true with this build; until then they are a promise the repo does not keep.

## Follow-up

* [ ] Create the monitor project and put `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_RELEASE` in the deployed environment before the build, or step 3 has nothing to talk to.
* [ ] Create an uptime or cron monitor in the monitor's own settings. An app that is down cannot report that it is down, so the daily ping only proves the app booted.
* [ ] Create the alert rule in the monitor's settings for a new issue by email. It is an operational step, not code.
* [ ] Add `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` and `SENTRY_SEND_IN_PREVIEW` to `.env.example` alongside the values it already lists.
* [ ] The existing `listings` and `users` timestamp columns are naive, which spec 0005's review flagged. The two new tables are correct, so a later migration should bring the old ones across, or the decision to leave them should be recorded.
* [ ] Spec 0009 must reuse this spec's `vercel.json` cron entry rather than define a second schedule.
* [ ] Session replay stays off. Revisit only if a buyer reports a UI problem that errors and breadcrumbs cannot explain.
* [ ] A simpler variant exists and was declined: drop the performance table and browser trace capture, which would remove the sampling tension and halve the adapter surface at the cost of AC-5's browser half.

## Rationale

Reasoning and options: see rationale.md.