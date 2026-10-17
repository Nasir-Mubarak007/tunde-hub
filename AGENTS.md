# TundeHub

A public shop for browsing social media accounts and getting sent into a WhatsApp chat, with one private admin panel for the owner.

## Stack

Mirrors spec [0001](docs/specs/0001-stack-and-architecture/index.md). That spec is the source of truth; this section only summarises it.

- **Language / Runtime**: TypeScript on Node, server components for reads and server actions for writes
- **Framework**: Next.js 16.4, App Router, React 19, `cacheComponents` on, `postgres` kept outside the bundle
- **Key dependencies**: Neon Postgres over the `postgres` driver, Drizzle ORM with `drizzle-kit`, Zod, Better Auth, UploadThing, Sentry
- **Package manager**: npm

## Build approach

**Skateboard**. Ship the thinnest usable whole product, then grow it. Source of truth is the header of [docs/scope/scope.md](docs/scope/scope.md).

## Commands

```bash
# Install
npm install

# Dev server
npm run dev

# Build
npm run build

# Lint / format / typecheck
npm run lint
npm run format
npm run typecheck

# Tests (runner being set up by /develop tooling)
npm test

# Schema changes (drizzle-kit writes to ./drizzle)
npm run db:generate
npm run db:migrate

# Create or promote the owner account
npm run seed:owner
```

## Git

- integration: on
- branch prefix: `feature/`
- commit: per-milestone

The workflow branches per feature, commits as each milestone lands, and drafts pull requests. Pushing and opening a pull request always ask first.

## Specs

Stored in `docs/specs/NNNN-title/`. The scope lives in `docs/scope/scope.md`.

The visual contract lives in [design.md](./design.md): character, tokens, component rules, and page composition. It outranks anything improvised in a page.

## Rules

Architecture is Clean Architecture, arranged folder by feature. Inside each feature folder the four layers are `domain`, `application`, `infrastructure`, `presentation`.

- Outer layers depend on inner layers only, never the reverse. `domain` has zero external imports.
- No framework, ORM, or HTTP client code inside `domain` or `application`.
- Use cases are thin orchestrators. Business rules live in entities and domain functions.
- Infrastructure implements interfaces declared in `domain` or `application` (dependency inversion).
- Entities are plain objects with no ORM decorators, and they enforce their own invariants.
- Cross layer calls pass plain objects or DTOs. No domain entity reaches the presentation layer.
- The error pattern is `Result<T, E>` from `src/core/result.ts`. Error codes are kebab case string literals, and every exhaustive switch ends in `assertNever()`.
- TypeScript is strict. No `any`, and exhaustive types on switches and unions.
- Named exports only. No default exports, except in the Next.js config files the framework requires.
- Every exported function and module carries a short doc comment saying what it takes and what it returns.
- One agreed error handling pattern across actions and routes. Domain failures are values, not thrown objects; only truly unexpected failures throw, and they reach Sentry.
- Validate environment variables at startup through one module, so a missing `DATABASE_URL` fails on boot, not mid request.
- Naming: components in PascalCase, functions and variables in camelCase, database tables plural in snake_case, files matching the thing they export.
- UI holds a WCAG AA baseline: every control reachable and operable by keyboard, visible focus, labelled inputs, and sufficient contrast.
- Styling comes from `src/app/globals.css`: CSS variables and BEM style class names. Tailwind v4 is bridged onto the same tokens through `@theme inline`, but no component uses utility classes and no new hex value is added.
- Conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`).

## Tooling

Install these with `/develop tooling`; the choices are recorded, nothing is installed yet.

- Lint and format: ESLint 9 with `eslint-config-next` (already installed) plus Prettier, wired together through `eslint-config-prettier`.
- Before every commit: a git hook runs lint, a format check, and typecheck.
- Quality gate: Vitest unit and integration tests, plus typecheck, plus a manual `/check verify` pass.
- Continuous integration: a GitHub Actions workflow running lint, typecheck, and tests on push and on pull requests.

## Agent skills

Project wide skills, loaded only when relevant to the task at hand.

- [neon-postgres](.agents/skills/neon-postgres/): `neondatabase/agent-skills`, pooled and direct connections, migrations, scale to zero
- [neon-postgres-branches](.agents/skills/neon-postgres-branches/): `neondatabase/agent-skills`, branching for development and migration testing
- [neon-drizzle](.agents/skills/neon-drizzle/): `neondatabase/ai-rules`, Drizzle setup guidance. Note it also offers to provision a new Neon project and its own connection style. Spec 0001 wins: use the existing project and the `postgres` driver.
- [vercel-react-best-practices](.agents/skills/vercel-react-best-practices/): `vercel-labs/agent-skills`, React 19 patterns for this App Router app
- [vercel-composition-patterns](.agents/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, where the server and client boundary belongs
- [better-auth-best-practices](.agents/skills/better-auth-best-practices/): `better-auth/skills`, session and configuration conventions
- [better-auth-security-best-practices](.agents/skills/better-auth-security-best-practices/): `better-auth/skills`, CSRF, cookies, plugin safety
- [sentry-nextjs-sdk](.agents/skills/sentry-nextjs-sdk/): `getsentry/sentry-for-ai`, wiring the Next.js SDK
- [sentry-fix-stack-traces](.agents/skills/sentry-fix-stack-traces/): `getsentry/sentry-for-ai`, source map upload at build time

MCP servers: Neon (recommended), Vercel (recommended), Sentry (recommended), GitHub (recommended), Context7 (recommended). Connect each in your own MCP settings; the agent cannot connect them for you.

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

- [src/app/AGENTS.md](src/app/AGENTS.md): routes, the loading policy under `cacheComponents`, and the hand written stylesheet
- [src/features/listings/AGENTS.md](src/features/listings/AGENTS.md): the listing entity, the claim rule, conditional sale writes, and money and slug conventions
- [src/features/auth/AGENTS.md](src/features/auth/AGENTS.md): Better Auth wiring, the owner gate, role rules, and the shared hourly rate limit cap

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._