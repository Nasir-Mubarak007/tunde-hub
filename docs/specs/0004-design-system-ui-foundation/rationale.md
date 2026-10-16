# Rationale for 0004. Design system and UI foundation

## Context

> Premise note: This topic spans tokens, themes, motion, type and parts. It reads as five builds but it is one standard because every screen depends on it. This spec keeps one decision and sizes rollout file by file. A single big rewrite of `src/app/globals.css` would stall Slice 1, so migration runs alongside new work.

You sell on phones. Most buyers arrive from a link and decide in seconds, so the shop must look credible at once while the owner panel must feel like a work space with a subtle cooler tone. Current `src/app/globals.css` holds warm paper tokens and full shop styles for grid, detail, auth and footer, but there are no written rules, no themes, no motion policy and no shared part contract to build from.

The team is small with one deployable app and server pages for reads. Budget is tight and access must hold at AA with keyboard use, visible focus and labelled controls. Reduced motion and touch targets matter on phones. Theme choice must stick across visits with no flash. Font must never block text.

Without this decision each screen invents colors, spacing and buttons. Themes fork. Motion annoys. Access regresses. Later cleanup costs more than a shared base now.

## Options considered

### Option 1: Document plus enforce going forward with Tailwind plus shadcn style parts

Define tokens, themes, motion, type and parts in `design.md`, add Tailwind plus shadcn style parts on Radix, enforce for new code at once and migrate old screens file by file (basis: your `AGENTS.md` reuse beats sprawl rule, spec `0003-storefront-browse-whatsapp-handoff/index.md` cards and detail, Next.js no flash guidance).

**Pros**:

1. New shop and panel work starts from ready parts so quality holds from day one.
2. Old CSS stays valid during migration so Slice 1 never stalls.
3. Themes, motion and access ship together with no flash and no regress.

**Cons**:

1. Two styling systems coexist for a while so CSS weight grows until migration ends.
2. Team learns Tailwind plus kit conventions on top of CSS you already know.

### Option 2: Keep plain CSS and enforce tokens by review

Keep `src/app/globals.css` as the only system, write `design.md` from it, add no new toolchain, enforce by checklist (basis: current `src/app/globals.css` token set, your `AGENTS.md` WCAG AA baseline).

**Pros**:

1. Zero new deps and fastest first paint on phones.
2. Smallest learning curve because you keep the CSS you wrote.

**Cons**:

1. You hand build every accessible primitive so focus, keyboard and state work costs more.
2. Theme vars and drift still need custom code with no kit to lean on.

### Option 3: Document plus single migration pass

Define the standard then rewrite all screens to Tailwind plus kit in one coordinated pass (basis: strangler versus big rewrite practice, Slice 1 schedule pressure).

**Pros**:

1. One clean end state with no dual systems and no debt to track.
2. Review stays simple because old patterns vanish at once.

**Cons**:

1. Large rewrite blocks Slice 1 and risks regress on grid, detail and auth at once.
2. Any miss in themes or motion ships everywhere before verify catches it.

### Option 4: Document only with no enforcement

Write `design.md` and rely on review with no lint or type checks (basis: review convention practice, tooling feature timing).

**Pros**:

1. Least upfront cost, spec ships fastest.
2. No toolchain change while Slice 1 is in flight.

**Cons**:

1. Drift returns quickly because nothing fails the build on wrong use.
2. Access and theme rules fade under schedule pressure.

## Rationale

Option 1 fits the forces best. You asked for Tailwind plus a kit together with bold market feel, platform tints, roomier cards, animated shop background and light and dark themes on both sides, and the background check confirms that mix fits server pages when built on Radix with CSS vars (basis: engineer picks across all rounds, shadcn Base UI default note, Radix focus practice). Option 2 cannot give you ready accessible parts without hand building them. Option 3 risks Slice 1 with a big rewrite. Option 4 leaves no guard so drift returns.

Migration runs file by file for the same reason. Your shop already renders and sells the concept, so old CSS stays valid while new code uses tokens plus parts (basis: strangler pattern for live migration, current `src/app/globals.css` inventory). Radix stays the primitive base for stability while Base UI waits in follow up, theme uses an inline blocking script so cached static pages still paint right with no flash, and font uses the Next loader so text never blocks (basis: shadcn Base UI default note, Next.js no flash guidance, phone first need). Enforcement leans on review plus light automation so rules hold without heavy ops.

## References

**Project sources** (verifiable, in this repo):

1. Your `AGENTS.md` stack, Skateboard approach, Clean Architecture layers and WCAG AA baseline.
2. Spec `0001-stack-and-architecture/index.md` single app with server pages and server actions.
3. Spec `0003-storefront-browse-whatsapp-handoff/index.md` grid, detail, claim plus chat and sold states.
4. Current `src/app/globals.css` warm paper tokens and shop styles.
5. Scope row 4 in `docs/scope/scope.md` asking for type, color, spacing, components, focus and keyboard.

**Practices and standards**:

1. WCAG AA with visible focus, keyboard use, labelled controls and enough contrast.
2. Reduced motion gating so drift stays still on request.
3. Cookie plus class theming so server paints right theme before paint with no flash.
4. Server pages for reads with client only at the interactive edge.
5. Strangler migration for live stylesheets.

**Links** (web verified only):

1. Tailwind Next.js install guide: https://tailwindcss.com/docs/installation/framework-guides/nextjs
2. Next.js Tailwind styling guide: https://nextjs.org/docs/app/building-your-application/styling/tailwind-css
3. Next.js no flash guide: https://nextjs.org/docs/app/guides/preventing-flash-before-hydration
4. shadcn Base UI default note: https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
5. Radix primitives docs: https://www.radix-ui.com/primitives/docs
6. next-themes repo: https://github.com/pacocoursey/next-themes
7. MDN reduced motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
8. shadcn MCP docs: https://ui.shadcn.com/docs/mcp

## Evidence

1. Inventory from `src/app/globals.css`: vars for surface, panel, sunk panel, ink, muted ink, line, strong line, chat, strong chat, sold ink, sold face, danger, focus, plus 14 and 10 radii and shadow. Classes for shell, shop header, buttons in solid quiet chat variants, banner, filters, fields, grid, cards with cover badges body price, skeletons, empty, paging, detail grid gallery facts, gate plus panel, auth wrap plus card plus tabs, footer, plus 640 and 1024 breakpoints.
2. Landscape scan result: Tailwind v4.3 uses PostCSS plugin with CSS import and class based dark variant. Accessible kit choice is shadcn pattern on Radix with Base UI now default and Radix still supported. Theme pattern is class on html plus blocking script before paint with cookie read to avoid flash. Motion pattern is still by default with drift only under no preference.
3. Tool discovery result: chosen `secondsky/claude-skills@tailwind-v4-shadcn` for Tailwind plus shadcn conventions. Skipped shadcn MCP so it is recorded in Follow up and not offered again (basis: shadcn MCP docs).
