# 0004. Design system and UI foundation

**Date**: 2026-10-15
**Status**: Proposed

## Summary

You get one shared look for the shop and the owner panel so buyers trust the store on phones (small screens buyers reach from a link). It keeps your warm paper tokens (named color and spacing values you already use) and adds light and dark themes (color sets for day and night) plus soft motion on the shop banner. You may reuse the same buttons, cards, fields, header, footer and feedback parts everywhere so every screen stays steady.

## Decision

**Chosen option**: Option 1: Document plus enforce going forward with Tailwind plus shadcn style parts

You may build all new UI from shared tokens and shadcn style parts on Tailwind, with existing `src/app/globals.css` kept as the token source until each screen migrates (basis: your `AGENTS.md` reuse beats sprawl rule, spec `0003-storefront-browse-whatsapp-handoff/index.md` grid and detail needs, Tailwind Next.js install guide, Next.js Tailwind styling guide).

**Implementation skills**: `vercel-react-best-practices` (`.agents/skills/vercel-react-best-practices/`), `vercel-composition-patterns` (`.agents/skills/vercel-composition-patterns/`), `secondsky/claude-skills@tailwind-v4-shadcn` (pending install, see Follow up)

## Standard definition

You may treat `design.md` as the source of truth for look, and build only from the parts below so new screens match old screens.

**Canonical pattern**:

```css
@import "tailwindcss";

:root {
  --surface: #fbf9f6;
  --panel: #ffffff;
  --panel-sunk: #f4efe8;
  --owner-surface: #f2f4f6;
  --ink: #1a1917;
  --ink-muted: #635c53;
  --line: #e7dfd4;
  --line-strong: #d6cbbc;
  --chat: #157347;
  --chat-strong: #0f5c36;
  --sold-ink: #4a443c;
  --sold-face: #ece4d8;
  --pending-bg: #fdf3e3;
  --pending-ink: #7a4a00;
  --danger: #9c2b1e;
  --focus: #1a1917;
  --tint-instagram: #e1306c;
  --tint-tiktok: #111111;
  --tint-youtube: #c4302b;
  --tint-x: #1a1917;
  --radius: 14px;
  --radius-small: 10px;
}

.dark {
  --surface: #161412;
  --panel: #201d19;
  --panel-sunk: #2a2621;
  --owner-surface: #1a1e22;
  --ink: #f4efe8;
  --ink-muted: #b8ad9f;
  --line: #3a352e;
  --line-strong: #544c40;
  --chat: #2ea36b;
  --chat-strong: #35b578;
  --sold-ink: #e8ddcb;
  --sold-face: #3a332a;
  --pending-bg: #3a2c14;
  --pending-ink: #f5c86e;
  --danger: #e07a5f;
  --focus: #f4efe8;
  --tint-instagram: #f0568c;
  --tint-tiktok: #f4efe8;
  --tint-youtube: #e86059;
  --tint-x: #f4efe8;
}

@keyframes drift {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(24px, -12px, 0); }
}

.banner__drift {
  animation: drift 24s ease-in-out infinite alternate;
}

@media (prefers-reduced-motion: reduce) {
  .banner__drift {
    animation: none;
  }
}
```

```tsx
// Button built on a shadcn style primitive. Server pages render it. Client only at the interactive edge.
import { Button } from "@/shared/ui/button";

export function BuyAction() {
  return <Button variant="chat" size="wide">Continue in WhatsApp</Button>;
}
```

1. Tokens use the vars in the block above. Light values match current `src/app/globals.css`. Dark values mirror each name. Day and night contrast gets checked in verify (basis: current `src/app/globals.css` token set, your `AGENTS.md` WCAG AA baseline).
2. Spacing uses 4, 8, 12, 16, 24, 32 steps. Card padding is 20. Shell stays 1120 with 16 side gaps. Corners stay 14 and 10 (basis: current `src/app/globals.css` shell and grid rules, engineer pick for roomier cards).
3. Type uses Inter 700 for display titles and price plus system stack for body with swap fallback so text shows at once. Title 32 on wide and 26 on phones, body 16 with 1.5 height, small 14 and 13 for meta (basis: engineer pick for Inter plus display, phone first need).
4. Themes follow system setting by default plus kept toggle in header and owner panel. Choice lives in `theme` cookie for one year with values light and dark and system default. Layout reads it and a blocking script in `src/app/layout.tsx` head paints the class before paint with no flash plus `suppressHydrationWarning` (basis: Next.js no flash guidance, next themes helper pattern, engineer pick for system plus toggle, Tailwind Next.js install guide).
5. Motion is soft drift on banner only using the drift keyframes above over 24 seconds. Hover and focus changes stay instant. All animate utilities get gated by the reduced motion query so nothing moves on request (basis: MDN reduced motion practice, engineer pick for soft drift).
6. Parts are shadcn style on Radix for stability with Base UI noted for later. Server pages render them. Client only at the interactive edge. Button props are variant solid quiet chat plus size default small plus wide flag. Card props are cover, platform, title, meta, price and badge. Field props are label, control, hint and error. Grid, detail, header, footer, skeleton, empty and error follow the same token props (basis: spec `0003-storefront-browse-whatsapp-handoff/index.md` cards and detail, engineer pick for Tailwind plus shadcn, shadcn Base UI default note, Radix focus practice).
7. Copy stays short. Empty says no listings match with a clear filters action. Error says load failed with retry that keeps focus. Sold badge says sold. Pending says reserved while the owner confirms. Platform chips name the platform with a tint dot (basis: engineer picks for unhappy states and tints).
8. Access holds at least 44 px targets for buttons and fields with whole card tappable through one stretched link so grid stays roomy on phones. Focus ring stays 3 px with skip link, labelled controls and enough contrast including dark chat green (basis: your `AGENTS.md` WCAG AA baseline, engineer picks for touch plus focus and motion care).
9. Font loads through Next font loader with display swap and system fallback so offline stays readable (basis: phone first need, engineer pick for swap with fallback).

**Replaces**:

1. Ad hoc hex values in new CSS (use tokens instead)
2. New buttons or fields drawn per screen (use shared parts instead)
3. Local only theme that flashes on first paint (use cookie plus class instead)
4. Motion that ignores reduced motion (gate all drift instead)

**Enforcement**:

You may enforce tokens and parts in review plus automated checks where they exist. Token use is checked by style rules in `stylelint.config.js` that ban hard coded hex outside vars (to be added with tooling). Props stay typed so `npm run typecheck` fails on wrong prop use, while token misuse is caught by lint plus review never by typecheck. Access is checked by keyboard pass plus day and night contrast pass in verify. Checklist lives in pull request template.

**Rollout**:

You may apply this to new code at once and migrate existing screens file by file in this order: tokens, buttons plus fields, cards plus grid, header plus footer, detail plus auth, owner panel last. Existing `src/app/globals.css` stays valid until each screen moves. Tailwind shares the same vars so no parallel color system grows. No single big rewrite. Track old hex use as debt in Follow up. Done means `design.md` is complete and shop plus auth run on parts with verify green.

**Exceptions**:

1. Third party embeds keep their own styles, for example `uploadthing` widgets.
2. None otherwise.

## Consequences

**Positive**:

1. Shop and panel share one look so trust holds on phones.
2. Themes plus motion ship without flash or access loss.
3. New screens compose from ready parts so build stays fast.

**Negative / tradeoffs**:

1. Two styling systems live together during migration so you carry extra CSS for a while.
2. Tailwind plus kit adds toolchain weight and learning versus plain CSS you know.
3. Theme vars double color review because every change needs day and night check.

**Neutral**:

1. `design.md` becomes required reading before UI work.
2. Font fetch adds one network request with system fallback in place.

## Follow-up

1. [ ] Install `secondsky/claude-skills@tailwind-v4-shadcn` before UI build so conventions load in context.
2. [ ] Record styling conventions in root `AGENTS.md` and panel notes in nested area docs during sync.
3. [ ] Add token lint (`stylelint.config.js`) plus access checklist to pull request template with tooling.
4. [ ] Note skipped shadcn MCP (`npx shadcn@latest mcp`) here so later work does not offer it again.

## Rationale

Reasoning and options: see `rationale.md`.
