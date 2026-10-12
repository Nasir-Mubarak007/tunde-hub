# Account Storefront

A public shop for social media accounts. Visitors browse listings, open one, and are handed
off to the owner's WhatsApp chat. The owner manages listings from a private panel.

## Stack

Next.js 16 (App Router) on TypeScript, Neon Postgres with Drizzle ORM, Better Auth,
UploadThing for screenshots, Vercel Hobby hosting. The full decision record lives in
[docs/specs/0001-stack-and-architecture](docs/specs/0001-stack-and-architecture/index.md).

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in `.env.local` as features need it. Values come from Neon, UploadThing, Sentry and
your own auth secret. No secret is ever committed: `.gitignore` covers `.env*` and only
`.env.example` is tracked.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |

## Status

Scaffold only. The data model, design system, public storefront and owner panel are still to
come. See [docs/scope/scope.md](docs/scope/scope.md) for the plan.
