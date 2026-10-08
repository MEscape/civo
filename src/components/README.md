# Global Components (`@components`)

Shared UI used by more than one module or by framework entry points. Nothing here imports a business module; see [`docs/rules/shared.md`](../../docs/rules/shared.md).

## `@components/ui` (Design-system primitives)

Built on **shadcn/ui** and **Radix UI**, adapted to the design tokens in `src/app/globals.css`. Add a primitive with the shadcn CLI (`npx shadcn add …`) when a module needs it, and remove it when its last consumer goes.

- **Primitives:** Accordion, Alert, Badge (`default`, `secondary`, `outline`, `muted`, status variants), Button (`default`, `secondary`, `accent`, `outline`, `ghost`, `destructive`, `link`; use `buttonVariants` to style a link as a button), Card, Input / Textarea / Label, Select, Skeleton (decorative: the busy region announces loading), Switch, Table, Tabs.
- **Icons:** `icons.tsx` holds the custom SVG icons on one shared 24×24 stroke canvas; `dynamic-icon.tsx` renders an icon named by content data, falling back to a known icon.

## `@components/layout` (Layout primitives)

`layout-primitives.tsx`: `PageShell`, `AppHeader`, `AppBody`, `Container`, `Section` (`tone`: `default` | `muted`), `SidebarLayout`, `PageHeading` (the page's single `h1`), `SectionHeading` (`h2`), `Divider`, `EmptyState` (`variant`: `plain` | `outlined`), `Grid` (container-query columns).

`app-nav.tsx`: `AppNav`, a header's navigation links. A Client Component so the locale-aware `Link` does not read the request while a layout prerenders.

## `@components/shared` (Composites)

- `text-field.tsx`, `select-field.tsx`, `field-message.tsx`: labelled form fields with hints and errors wired to `aria-describedby`.
- `loading-status.tsx`: `LoadingStatus`, the one screen-reader announcement inside loading UI (`app.loading`); skeletons stay `aria-hidden`.
- `not-found-panel.tsx`: the body of every `not-found.tsx`.
- `route-error-panel.tsx`: the body of every `error.tsx`; it never shows the raw error message.

## `@components/providers`

- `i18n-provider.tsx`: Server Component that hands a subtree only the message namespaces it declares (always including the app shell's `app`).
- `i18n-client-provider.tsx`: the client side of it.
