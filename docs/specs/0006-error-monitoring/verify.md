# Verify: Error monitoring · spec 0006 · updated 2026-10-18
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Setup before any step
- [ ] `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` set, `SENTRY_ORG=mubarak-r0`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` set in the environment that runs the build → AC-1, AC-10
- [ ] Run the app the way production runs it, `npm run build && npm start`, because reporting is off in `npm run dev` → AC-9
- [ ] An outage monitor and the new issue alert exist in the monitor's own settings, they are not code → operational, not an AC

## UI / manual
- [ ] Sign in as the owner, open a listing that is available, press Confirm sold on a pending row, then force a failure on the page right after (break a component temporarily) → the monitor shows the issue with a readable file and line and its context lists the `listing.transition` move that came before it → AC-1, AC-6
- [ ] Open the server log for the same move → still exactly one `listing.transition` line per move → AC-6
- [ ] Press Release on a row that is already available (a domain refusal), then check the monitor and both tables → nothing new anywhere → AC-2
- [ ] On a phone sized window, open `/listings/<a real slug>`, cause a browser failure, then look at the stored `route` values → the template `/listings/[param]`, never the slug, and no query string anywhere in the event → AC-3
- [ ] Sign in as a buyer, trigger a slow page (or throttle the network so a request passes three seconds) → a slow request row appears, and a quick page load adds none → AC-5
- [ ] Call `/api/cron/health` with no header, then a wrong secret → `401 {"error":"unauthorized"}` both times → AC-7
- [ ] Call `/api/cron/health` with `Authorization: Bearer <CRON_SECRET>` → `200 {"ok":true,"pinged":true,"pruned":{"errorEvents":n,"slowRequests":m}}`, and the monitor shows one message event naming the app and the environment → AC-7
- [ ] Point `SENTRY_DSN` at a dead host, restart, then load every page and press every action → every page still answers, nothing throws, and a local row exists for each captured failure → AC-4, AC-8
- [ ] Run `npm run dev`, trigger a failure, then query both tables → no new rows and no event in the monitor → AC-9
- [ ] Deploy a preview, then a production build, and compare the environment name in the monitor → they are never confused → AC-9

## Commands
- [ ] `npm run typecheck` and `npm run lint` → both clean → AC-1, AC-2, AC-3
- [ ] `npm run db:generate && npm run db:migrate` against a fresh branch → `error_events` and `slow_requests` exist with `occurred_at` as `timestamp with time zone` defaulting to `now()`, both enums present, four indexes present → AC-4
- [ ] `select * from error_events order by occurred_at desc limit 1` → the row's `occurred_at` sits within a second of the failure time and carries the monitor's event id, and the row is the scrubbed text the monitor received, not a richer copy → AC-3, AC-4
- [ ] `select * from slow_requests order by occurred_at desc limit 1` → `duration_ms` at or above 3000, `method` present on the server, and no row for a faster request → AC-5
- [ ] Backdate a row: `update error_events set occurred_at = now() - interval '40 days' where id = <n>`, then run the daily route → that row is gone and the counts name it → AC-7
- [ ] Temporarily break the insert (rename the table in a scratch copy) and run the daily route, then load a page → the page still answers, the job reports the failure, and nothing is thrown into a response → AC-8
- [ ] `SENTRY_AUTH_TOKEN=bogus npm run sourcemaps:upload` → prints a warning, exits `0`, and `npm run build` still finishes green → AC-10
- [ ] `grep -rn "captureException" src` → nothing outside the observability area, and the only explicit capture is the daily ping → AC-2
- [ ] A build with a real token, then read one new issue in the monitor → its frames name your real files and lines, not `chunk-*.js` → AC-1, AC-10

## Value sourcing, one row at a time
- [ ] Failure `route` → the App Router template on the server, and on the browser the pathname with dynamic segments in bracket form, so a slug reaches neither destination → AC-3
- [ ] Failure `route` when there is none → the owned `ROUTE_UNKNOWN` constant, never a blank → AC-4
- [ ] Failure `side` → the hook that captured it, server or browser → AC-4
- [ ] Failure `kind` → the hook that produced it: the unhandled request hook, an explicit recorder call, or a server action failure the browser saw → AC-4
- [ ] Failure `message` and `stack` → the thrown error through `scrubText`, so an email or a long digit run in the message reads `[redacted]` in both the monitor and the table → AC-3
- [ ] Failure `occurred_at` → the database clock, checked against the failure time, never an app clock → AC-4
- [ ] Failure `sentry_event_id` → the id already on the event, null when the event never went out → AC-4
- [ ] Slow request `method` → the request method on the server, null on a browser route change, which has none → AC-5
- [ ] Slow request `route` and `duration_ms` → the transaction name through the same routing rule, and the monitor's own duration, never a client clock → AC-5
- [ ] Slow request capture threshold → the owned `SLOW_REQUEST_MS`, verified by finding a row just under and just over three seconds → AC-5
- [ ] Traces sample rate → `SENTRY_TRACES_SAMPLE_RATE` defaulting to 1, so the threshold and not the sampler decides what is kept → AC-5, AC-9
- [ ] Breadcrumb content → the existing `TransitionLogEntry`, so the mirror cannot invent a state the app did not write, and the actor id is not among it → AC-6
- [ ] Daily schedule → the one `vercel.json` entry at `0 6 * * *` calling `/api/cron/health`, which spec 0009 reuses rather than adding a second one → AC-7
- [ ] Daily auth → `CRON_SECRET` compared in constant time, and no other credential accepted → AC-7
- [ ] Retention cutoff → computed inside the delete as `now() - 30 days`, proven by backdating a row and watching the route remove it → AC-7
- [ ] Daily ping → one message event naming the app and the environment, with no local row → AC-7
- [ ] Monitor environment name → `SENTRY_ENVIRONMENT`, defaulted from `VERCEL_ENV`, so production and preview are never confused → AC-9
- [ ] Whether anything reports at all → production only, or production plus preview when `SENTRY_SEND_IN_PREVIEW` is true with its own preview DSN, and the same gate guards the local write → AC-9

## Acceptance-criteria coverage
- AC-1 readable server and browser stack traces · AC-2 refusals capture nothing · AC-3 nothing leaves unscrubbed · AC-4 local rows for every server capture with the monitor's event id · AC-5 the three second threshold on both sides · AC-6 every move mirrored while the app log line stays · AC-7 the guarded daily route and its prune · AC-8 an outage and a failed insert change no response · AC-9 only production reports and only production writes · AC-10 every build uploads and a failed upload warns