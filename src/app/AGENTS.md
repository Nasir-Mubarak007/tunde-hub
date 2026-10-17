# App routes and styles

## Overview

Every URL in the shop, the two API route handlers, the root layout, and the one stylesheet that carries the whole visual language. Routes stay thin: they resolve params, call a use case through a feature container, and hand the result to a component.

## Key files

| File | Owns |
|---|---|
| `page.tsx` | the storefront grid, wrapped in `Suspense` with a skeleton |
| `listings/[slug]/page.tsx` | the listing detail, no `Suspense` on purpose |
| `listings/[slug]/not-found.tsx` | one generic body for unknown, taken and expired sold slugs |
| `admin/page.tsx`, `admin/listings/**` | the owner panel and its forms |
| `api/auth/[...all]/route.ts` | Better Auth, re exported through `toNextJsHandler` |
| `api/uploadthing/route.ts` | UploadThing, wrapped around the listings file router |
| `layout.tsx` | fonts, the blocking no flash theme script, the skip link |
| `globals.css` | every token and every class name in the product |

## Conventions

- `cacheComponents` is on. Routes that read a session export `instant = false` so they may block. The storefront home page keeps the instant default and wraps its read in `Suspense`.
- No components live in `src/app`. Every visual piece belongs to a feature's `presentation` folder, and `app` only routes.
- Routes never import Drizzle or a repository. They call a use case through the feature container and map the result to a DTO.
- `globals.css` is the single source of truth for styling: CSS variables for colour, spacing and radius, and BEM style class names. Tailwind v4 is installed and bridged onto the same variables through `@theme inline`, but no component uses Tailwind utility classes, and no new hex value is ever introduced.
- `design.md` at the repo root is the visual contract: character, tokens, component rules and page composition. Read it before building any UI.
- Revalidation and redirects belong to server actions, not to pages. Admin actions call `revalidatePath`, the claim action redirects to WhatsApp or back to the detail URL with a reason query param.
- The detail route has no `Suspense` boundary on purpose, so `notFound()` returns a real 404 status.

## Gotchas

- The inline `THEME_SCRIPT` in `layout.tsx` must stay blocking and must run before paint, otherwise a dark mode visitor sees a light flash. It pairs with `suppressHydrationWarning` on `<html>`.
- `uploadthing-ssr.tsx` is a plugin boundary that no page currently renders. Adding it is a deliberate choice, not a leftover to tidy up.
- The root page is `noindex, nofollow` while the site is still being built.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._