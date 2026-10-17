# Auth

## Overview

Better Auth wired to the shared Drizzle client, the `owner` and `customer` roles, the one gate that protects every admin surface, and the hourly rate limit cap that signup and claim share. There is no `application` layer here: role rules are pure functions in `domain`, and the gate lives in `presentation` because it redirects.

## Key files

| File | Owns |
|---|---|
| `infrastructure/auth.ts` | the Better Auth instance: adapter, plugins, rate limit, signup hook |
| `infrastructure/auth-schema.ts` | the Drizzle tables and enums Better Auth expects |
| `infrastructure/sessionViewer.ts` | `getSessionViewer()`, the only server read of the session |
| `infrastructure/rateLimitStorage.ts` | the storage that puts the hourly window in the database |
| `presentation/ownerGuard.ts` | `requireOwnerViewer()`, the admin gate |
| `presentation/nextPath.ts` | the only safe shapes for a post sign in return path |
| `domain/user.ts`, `domain/userRole.ts` | `isOwner()`, `canAccessAdminPanel()` |
| `scripts/seed-owner.ts` | creates the first owner, idempotently |

## Conventions

- Better Auth owns passwords and sessions. Nothing in `src` reads or compares a password hash.
- Role checks are pure functions in `domain`, called by presentation. The gate is `requireOwnerViewer(path)`: anonymous goes to sign in with the path preserved, a signed in non owner goes to the storefront.
- Every route that reads a session exports `instant = false`, because with `cacheComponents` on those routes must be allowed to block.
- Rate limiting is enabled in every environment, on purpose. The one hour window delegates to the shared `rate_limit_clicks` table using the same keyed hash as the claim path, so signup and claim cannot be used to get around the cap. Other windows use a bounded in process `Map` capped at ten thousand entries with expiry pruning.
- Seed the owner by running `npm run seed:owner`. It signs up through the API so hashing stays inside Better Auth, then promotes the row. It never overwrites an existing password.
- `role` is an additional field with `input: false`, so a client cannot assign itself `owner`.

## Gotchas

- `databaseHooks.user.create.before` throws an `APIError` unless the role is `owner` or a display name is present, mirroring the `users_role_display_name_check` constraint. Change one and you must change the other.
- The auth client calls the API routes on purpose, so the hourly cap applies to browser sign in too.
- UploadThing is not an auth plugin. Its router middleware calls `auth.api.getSession` itself and throws `UploadThingError("Unauthorized")` unless the role is `owner`.
- `sessionViewer` downgrades to anonymous and logs when the session read fails, so a session error never takes the storefront down.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._