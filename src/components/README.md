# Global Components (`@components`)

Shared UI used by more than one module or by framework entry points. Nothing here imports a business module; see [`docs/rules/shared.md`](../../docs/rules/shared.md).

## `@components/ui` (Design-system primitives)

Built on **shadcn/ui** and **Radix UI**, adapted to the design tokens in `src/app/globals.css`. Add a primitive with the shadcn CLI (`npx shadcn add …`) when a module needs it, and remove it when its last consumer goes.

- **Primitives:** Accordion, Alert, Badge (`default`, `secondary`, `accent`, `outline`, `muted`, status variants), Button (`default`, `secondary`, `accent`, `outline`, `ghost`, `destructive`, `destructive-ghost`, `link`; **every delete, remove or withdraw trigger is `destructive-ghost`, with the `Trash2` icon where there is room, and asks through `ConfirmDialog` whose confirm is `destructive`: never a ghost button coloured by a class; use `buttonVariants` to style a link as a button), Card, Input / Textarea / Label, Select, Skeleton (decorative: the busy region announces loading), Switch, Table, Tabs (`TABS_LIST_CLASS_NAME` / `TABS_TRIGGER_CLASS_NAME` carry the look, with a hover state, for tabs that are links).
- **Pointer:** `globals.css` gives every enabled control (buttons, `summary`, selects, checkboxes, `role=button|tab|option|switch`) the pointer cursor in `@layer base`; do not repeat `cursor-pointer` per component.
- **Charts:** `chart-theme.ts` names the design tokens for Recharts, which takes colors as strings: `CHART_COLORS` (surfaces, text, `warning` for a status that is a warning), `CHART_SERIES_COLORS` (the categorical `--civo-chart-*` order), `TOOLTIP_STYLE`, `AXIS_FONT_SIZE`, `BAR_RADIUS`. Every chart states its numbers in text too.
- **Other primitives:** `ContentLink` (`content-link.tsx`) is a plain `<a>` for a target that comes from content (a municipality URL, `mailto:`, `tel:`, a published-site path); app navigation uses the locale-aware `Link` from `@i18n`. `PortalContainerContext` / `usePortalContainer` (`portal-container.tsx`) say where floating layers open: inside a modal `<dialog>` they must live inside it, since everything outside is inert.
- **Icons:** `icons.tsx` holds the custom SVG icons on one shared 24×24 stroke canvas; `dynamic-icon.tsx` renders an icon named by content data, falling back to a known icon.

## `@components/layout` (Layout primitives)

`layout-primitives.tsx`: `PageShell`, `AppHeader`, `SectionBar` (the sticky bar under the header that holds a website's or the platform's navigation; its fallback uses the same component, so both take the same room), `Container`, `Section` (`tone`: `default` | `muted`), `PageHeading` (the page's single `h1`), `SectionHeading` (`h2`), `EmptyState` (`variant`: `plain` | `outlined`), `Grid` (container-query columns).

`nav-disclosure.tsx` (`NavDisclosure`): a few navigation links behind one button (the disclosure pattern, not an ARIA menu); closes on Escape, outside click, after a link is followed and when the page is hidden. `fit-tabs.ts` (`fitTabs`): how many tabs fit the available width; the rest go behind a "more" button.

`AdminContainer`: the one content column of every admin page, so the navigation above a page shares its left edge.

`app-nav.tsx`: `AppNav`, the navigation links of the app bar (`variant="header"`) and the website bar under it (`variant="section"`: the website's name, then the tabs between its sections, the editor included), with the current page marked. A Client Component so the locale-aware `Link` and the current path do not read the request while a layout prerenders.

## `@components/shared` (Composites)

- `confirm-dialog.tsx`: `ConfirmDialog`, a modal question with a confirm (destructive by default, `confirmVariant="default"` when it only goes ahead), optional `children` for what the question needs beside its words (a list, a note field) and a cancel that holds the initial focus, on the platform's `<dialog>` (focus trap, Escape cancels). Pair with `useUnsavedNavigationGuard` (`@hooks/use-unsaved-navigation-guard`) to ask before in-app links, and controls marked `data-navigation-guard-leaves` (sign-out), discard unsaved work. **Limit:** the browser's back and forward buttons are not covered (the App Router has no supported hook for them, and a `popstate` workaround would be fragile); tab close, reload and external links stay with `useBeforeUnloadGuard`.
- `text-field.tsx`, `select-field.tsx`, `form-select-field.tsx`, `checkbox-field.tsx`, `field-message.tsx`: labelled form fields with hints and errors wired to `aria-describedby`. `select-field.tsx` is a controlled Radix select (`options`, `value`, `onValueChange`); a Radix select has no native input, so react-hook-form's `register` cannot drive it: `form-select-field.tsx` binds it to a form value through the controller. `checkbox-field.tsx` is a native checkbox with a visible focus ring; module forms and filters use it instead of a bare `<input type="checkbox">`.
- `combobox-field.tsx`: `ComboboxField`, a searchable list to pick from (ARIA combobox: arrow keys, Enter picks and never submits the form, Escape closes), single or multiple selection (chips with remove buttons, Backspace removes the last), optional "add what I typed" row (`createText`, `normalizeCreated`). The options are the complete set and are filtered locally (`combobox-model.ts`: accent- and case-insensitive); for options that come from a search pass `onQueryChange` (the owner debounces and drops stale answers) and the options are shown as given. All text arrives translated.
- `unsaved-changes-guard.tsx`: `UnsavedChangesGuard` and `useReportUnsavedChanges`, the guard for a screen made of several forms: each form reports whether it holds unsaved work, and while any does, in-app links ask first (`ConfirmDialog`) and tab close asks through the browser. All text is passed in already translated.
- `link-tabs.tsx`: `LinkTabs`, tabs that are addresses (the part shown lives in the URL, `aria-current` marks the current one), styled like `Tabs`.
- `link-card.tsx`: `LinkCard`, a card that is one link: the title is the link and stretches over the whole card, so the card is clickable with a single tab stop.
- `loading-status.tsx`: `LoadingStatus`, the one screen-reader announcement inside loading UI (`app.loading`); skeletons stay `aria-hidden`.
- `not-found-panel.tsx`: the body of every `not-found.tsx`.
- `route-error-panel.tsx`: the body of every `error.tsx`; it never shows the raw error message.

- `copy-button.tsx` (`CopyButton`): copies a value and says so for a moment; quiet where the clipboard is refused.
- `refresh-on-focus.tsx` (`RefreshOnFocus`): re-reads the page when its tab becomes visible again (at most every 30 seconds), so a screen left open is current on return. Renders nothing.
- `progress-bar.tsx` (`ProgressBar`): how far along something is, as a thin bar with an accessible name; the numbers go beside it in words.
- `filter-select.tsx` (`FilterSelect`): a select for a GET filter strip, with its label read out but not shown, so the strip's controls share one height. Each option names what it filters ("Any role", "25 per page").
- `data-panel.tsx` (`DataPanel`): the frame of a list or table that is the subject of a screen: a tinted header with the title and the actions on the whole list, the rows, an optional footer. Put a `Table` inside with `containerClassName="rounded-none border-0"`.
- `form-panel.tsx` (`FormPanelBody`, `FormPanelFooter`): the fields and the foot (status left, actions right, submit last) of a form inside a `DataPanel`; every form in a panel ends the same way.
- `list-pagination.tsx` (`ListPagination`): the page links of a list, worded the same on every list ("26–50 of 120"), drawn only when there is more than one page; put it in a `DataPanel` footer. It takes a `Page<T>` slice and wraps `Pagination`.
- `page-skeleton.tsx` (`PageSkeleton`): the placeholder of an admin page while its data streams in, shaped like a heading plus a `DataPanel` (title strip, filter strip, rows). Cache Components needs a real placeholder at every dynamic boundary; use it in `loading.tsx`.
- `password-field.tsx` (`PasswordField`): a password input that can show what was typed and warns while Caps Lock is on; label, hint, error and warning are one accessible unit, with room for guidance (a strength meter) below.
- `user-avatar.tsx` (`UserAvatar`): the round monogram in front of a person's name, shared by every people table.
- `breadcrumbs.tsx` (`Breadcrumbs`): where a page sits and the way back up; the last step is the page itself.
- `process-steps.tsx` (`ProcessSteps`): how something goes, as numbered steps in order.
- `overview-card.tsx` (`OverviewCard`, `OverviewRow`): a block of an overview page, a quiet title with an optional link to the subject's own page, and rows of facts divided by hairlines. For information at a glance, not for forms.
- `pagination.tsx` (`Pagination`): previous / next and the pages around the current one, as plain links built by the caller (`hrefFor`), so filters stay in the address. Labels are passed in already translated. Used with `@lib/pagination`.

## `@components/providers`

- `i18n-provider.tsx`: Server Component that hands a subtree only the message namespaces it declares (always including the app shell's `app`).
- `i18n-client-provider.tsx`: the client side of it.

## `@components/brand`

- `ArtemisLogo` (`variant="mark"` or the full wordmark): Artemis Connect, the company behind the platform, as inline SVG paths in `currentColor`, so it follows the theme.
- `AppBrand`: the product in the admin bar (mark, product name, "by …" byline) as one link.
- `PoweredBy`: a quiet credit for pages that carry a municipality's brand (its public site); the site's own logo stays the main one.

## `@hooks`

Client hooks used by more than one module. `useUnsavedNavigationGuard` and `useBeforeUnloadGuard` ask before unsaved work is left (see `ConfirmDialog` above); `useCountdown(seconds)` counts whole seconds down for a button that may be pressed again after a wait ("send again in 42s"); `useDismiss(isOpen, rootRef, onDismiss)` reports a pointer press outside a popup or Escape (`'outside'` | `'escape'`) and consumes Escape, so a popup inside a modal `<dialog>` closes alone: the caller closes and, on `'escape'`, returns focus to the trigger (`NavDisclosure`, the booking date picker).
