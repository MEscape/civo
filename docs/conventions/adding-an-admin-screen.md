# Adding an Admin Screen

Owning rules: [`styling.md`](../rules/styling.md), [`react.md`](../rules/react.md), [`accessibility.md`](../rules/accessibility.md), [`i18n.md`](../rules/i18n.md), [`validation.md`](../rules/validation.md).

Generator: none

Admin screens are used all day by the same people, so every screen is built the same way: a person who knows one list, one create flow and one delete knows them all. Start from the shared pieces listed in [`src/components/README.md`](../../src/components/README.md); the data-sources screens are the reference implementation.

## Checklist

1. Frame the route with `AdminPage` and `AdminPageHeader` (`@components/layout/admin-page`). The header carries the title, the lead, the breadcrumb on any screen below a list (`crumbs`), and the screen's main action at the far edge (`actions`). Do not add a separate back link or a second `h1`.
2. Put notices (truncated lists, unavailable data, success after a redirect) between the header and the panels, never inside a panel.
3. Show a list as `DataPanel` > optional toolbar > `ResponsiveTable` > `Pagination` in the footer when there is more than one page. The panel's `meta` is the total as a plural count. Add `FilterSearchField` when the list can grow without bound, `FilterChips` for one small categorical dimension, and `SortLink` on the columns a person orders by.
4. Lay out row actions as `justify-end gap-1`: navigation is a ghost button "Open" with an arrow, editing a labelled ghost button, deleting a labelled `destructive-ghost` button. Avoid icon-only actions.
5. Put creation on its own `/new` route, opened from the header action. Render a `Wizard` driven by `useWizardSteps` over one react-hook-form form, end with a review step, protect unsaved work, and `router.replace` to the next screen after saving.
6. Edit in place with a form in a `DataPanel` that ends in `DataPanelSaveFooter`; larger configuration reuses the create wizard prefilled.
7. Confirm every destructive action. When something may still use the item, use `DeleteWhenUnusedDialog` with links to each use, and re-read the screen when the server refuses because of a new use.
8. Report outcomes with `FieldMessage` and `FieldSuccess`; never hand-write `role="alert"` text.
9. Give empty lists an `EmptyState` with a domain icon and, when the person may create, the create action. Distinguish "nothing matches the filters" from "nothing yet". Use `OnboardingChecklist` where the next steps of a first-time setup are not obvious.
10. Give the route a `loading.tsx` or Suspense fallback assembled from `@components/skeletons/admin-skeletons`, shaped like the screen.

## Done when

- [ ] The screen uses `AdminPage`/`AdminPageHeader`, and its main action sits in the header.
- [ ] Lists, row actions, empty states and counts look like the other admin lists.
- [ ] Create, edit and delete follow the shared flows above, including confirmation and unsaved-work protection.
- [ ] The loading placeholder has the screen's shape and spacing.
- [ ] Tests cover the screen's interactions by role and accessible name.
