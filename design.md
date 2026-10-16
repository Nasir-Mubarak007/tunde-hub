# Design system

Source of truth for look. Token values live in `src/app/globals.css`. Build only from the parts in `src/shared/ui`.

## Character

Warm paper shop. Near black ink on light warm neutral. One green kept for the WhatsApp action. Calm panels, roomy cards, soft shadow. Owner panel uses a cooler surface but the same ink and line language. Phone first, since most buyers arrive from a link on mobile.

## Build mandate

You build every new screen from shared tokens and shared parts. You never invent a hex, a button, or a field per screen. You render parts on the server. You reach for client code only at the interactive edge (theme toggle, form tabs). Existing `src/app/globals.css` class names stay valid until each screen migrates. Tailwind shares the same vars, so no parallel color system grows.

## Composition

Home order: header with sign in state plus theme toggle, short intro banner with soft drift, filter bar, card grid, empty state, paging. Detail order: gallery, price, facts, description, claim button, sold banner when sold. Auth: branded side plus card with sign in and create account tabs. Footer closes every public page.

## Tokens (pointers, values in CSS)

Colors: `--surface --panel --panel-sunk --owner-surface --ink --ink-muted --line --line-strong --chat --chat-strong --sold-ink --sold-face --pending-bg --pending-ink --danger --focus`, plus platform tints `--tint-instagram --tint-tiktok --tint-youtube --tint-x`. Dark mirrors every name under `.dark`.

Spacing steps: 4 8 12 16 24 32. Card padding 20. Shell 1120 with 16 side gaps. Corners 14 and 10. Shadow `--shadow`.

Type: Inter 700 for display titles and price (`--font-display`, swap fallback), system stack for body. Title 32 wide and 26 phones, body 16 with 1.5 height, small 14 and 13 meta.

Themes: system by default, toggle kept in header and owner panel. Choice lives in `theme` cookie for one year (`light` `dark`, absent means system). A blocking script in `src/app/layout.tsx` head paints the class before paint with no flash plus `suppressHydrationWarning`, so routes still prerender.

Motion: soft drift on banner only (`drift` 24s ease in out alternate). Hover and focus stay instant. All motion gated by `prefers-reduced-motion`.

## Component and usage rules

Do: use `Button` variant `solid` `quiet` `chat`, size `default` `small`, `wide` flag for full width. Use `Field` with label, control, hint, error. Use `Card` props cover, platform, title, meta, price, badge. Grid, detail, header, footer, skeleton, empty, error follow the same token props. Keep targets 44px or taller. Keep whole card tappable through one stretched link. Keep focus ring 3px with skip link, labelled controls, enough contrast including dark chat green.

Do not: add ad hoc hex outside vars. Draw new buttons or fields per screen. Ship a theme that flashes on first paint. Ship motion that ignores reduced motion.

Copy stays short. Empty says no listings match with a clear filters action. Error says load failed with retry that keeps focus. Sold badge says sold. Pending says reserved while the owner confirms. Platform chips name the platform with a tint dot.

Third party embeds (uploadthing widgets) keep their own styles. Nothing else is exempt.

## Stack

Tailwind v4 (`@import "tailwindcss"`, class based dark via `@custom-variant dark`) mapped onto the same vars through `@theme inline`, so utilities read the tokens. Parts are shadcn style on Radix primitives for stability (Base UI noted for later). Server pages render them. Font loads through the Next font loader with display swap and system fallback.
