---
trigger: manual
---

# Design System Standard

Source of truth for every color, radius, spacing and font is `src/app/globals.css`. Components use **token utilities only**. `src/lib/design-tokens.test.ts` enforces this and fails the build; if it flags something, add a token, do not bypass the test.

## 1. Tokens only

Write `bg-primary`, `text-copy-muted`, `border-border-strong`, `rounded-token`, `space-y-section`, `font-heading`, `h-app-body`. Never write Tailwind palette colors (`red-700`), `white`/`black`, hex/rgb literals, arbitrary values (`w-[240px]`, `min-h-[50vh]`, `bg-[var(--civo-...)]`), or `h-screen`.

A token name says what the color is **for**, and never reuses a shadcn name for a different role (shadcn's `bg-muted` is a surface, so a *text* color must not be called `muted`). Text is `copy*`, surfaces are `canvas`/`surface`.

## 2. A brand color has three roles

A municipality picks its colors, so none can be assumed readable. Per brand color `X` (primary, secondary, accent):

| Role | Utility | Guarantee |
|---|---|---|
| Fill, border, background | `bg-X`, `border-X` | none (the raw color) |
| Text ON that fill | `text-X-foreground` | white or black, always AA |
| The color AS text or an icon on the page | `text-X-copy` | darkened just enough for 4.5:1 |

`text-primary` / `text-accent` / `text-secondary` are forbidden. Status colors (`success`, `warning`, `danger`, `info` and `-subtle`, `-border`) are static and never come from a brand color.

## 3. Tokens derived from themable tokens

`var()` inside a custom property resolves where it is **declared**. A token derived from a themable color (e.g. the chart palette) must be declared on `:root, [data-civo-theme]`, or it captures the default theme forever. `theme-css-sync.test.ts` checks this.

## 4. Responsive

- **Page components** (anything rendered inside `ThemeProvider`) use container variants: `@2xl:`, `@5xl:` (sm -> `@2xl`, md -> `@3xl`, lg -> `@5xl`). The builder shows the page inside a 390px or 768px frame on a wide screen, and viewport variants would render the desktop layout squeezed into it.
- **App chrome** (toolbar, shell) uses viewport variants; below `lg` side panels become `Sheet`s.
- Full-height workspaces use `h-app-body` (`dvh`), never `vh`.
- No horizontal page scroll at 320px. Fix the layout, do not add `overflow-x-hidden`.
- Touch: controls grow to 44px with `pointer-coarse:`; 24px is the hard minimum (WCAG 2.5.8).

## 5. Data widgets

- Never `return null` on error or empty. Use `WidgetState` (keeps the heading, plain German text, no technical detail). Log the cause server-side.
- Show freshness with `MetricFreshness` (`updatedAt`, `source`). Never fabricate a timestamp; an absent one renders nothing.
- Numbers go through `metric-format.ts` (German separators, real minus sign, sign taken from `trend`).
- Charts: color never carries meaning alone. Every value also appears as text, segments are separated by a page-colored stroke, and animations respect `prefers-reduced-motion`. A chart hidden with `aria-hidden` must have no tab stops inside it.

## 6. Verify layout in a browser

Unit tests run in jsdom, which has no layout and no CSS. They cannot catch overflow, clipping, wrong breakpoints or a stale overlay. A layout change is not verified until it has been rendered (axe-core for accessibility, plus a check at 320, 375, 768, 1280 and 1920px).
