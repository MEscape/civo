# Adding a Platform Component

Owning rules: [`modules.md`](../rules/modules.md), [`boundaries.md`](../rules/boundaries.md), [`i18n.md`](../rules/i18n.md), [`styling.md`](../rules/styling.md), [`accessibility.md`](../rules/accessibility.md). How the platform works: [`component-platform.md`](../architecture/component-platform.md).

## Checklist

1. If the component shows records, find or add its **content kind** in `domain/content` (`<kind>.content.ts`, with sample records; `scale: 'dataset'` only for a kind shown whole, such as a map or chart) and register it in `content-definitions.ts`. A new kind also needs mapping targets in `data-sources`.
2. Declare it in `domain/components/<category>/<name>.component.ts` with `defineComponent`: `type` (camelCase, stable), `category`, each prop with `prop.*`, `dataBinding` when it reads a kind (and then a `limit` prop: `prop.number(LIST_LIMITS.cards | LIST_LIMITS.dataset)` by the scale the kind declares; pass `props.limit` to `loadContent`, never a constant of your own), `municipallyEditable` and `municipal: true` on the props a municipality may edit.
3. Add the definition to `COMPONENT_DEFINITIONS` in `domain/components/component-definitions.ts`.
4. Build the implementation in `presentation/components/<category>/<name>/<name>.tsx`: a Server Component that takes `{ props, context, loadContent }`, loads through `loadContent`, and handles `error`, `empty` and `sample` origins with the shared `ContentState` and `ContentOriginBadge`. Put interactivity in a small `.client.tsx` leaf.
5. For an async (data-loading) component add `<name>.skeleton.tsx` built from `skeleton-blocks`.
6. Register it in `COMPONENT_IMPLEMENTATIONS` (`page-renderer/component-implementations.tsx`) with `implementComponent('<type>', { render, skeleton })`. The compiler fails until steps 3 and 6 agree.
7. Style with the tokens of `globals.css` only, adapt to the width of the container (`@container`, `@3xl:`), and keep text readable on the brand colours (`text-primary-copy`, never `text-primary`). Follow [`styling.md`](../rules/styling.md).
8. Add the texts in `presentation/i18n/de.json` and `en.json`: `components.<type>.label`, `.description`, `.fields.<prop>.label` (and `.placeholder`, `.options.<value>` where the prop has them), plus the strings the component renders. See [`adding-a-translation.md`](adding-a-translation.md).
9. Write a definition test (defaults, parsing, municipal props) and, for rendering with branches, a presentation test.
10. Run `npm run components:lock` and commit `component-versions.lock.json`. A **new** component starts at version 1; a change to an existing one needs a higher `version` first (the architecture test says so).
11. Run `npm run check`.

## Done when

- [ ] The definition, the implementation and the texts exist and `tsc` is clean
- [ ] The component renders in the editor canvas with sample data and with no dataset chosen
- [ ] It works at phone width inside the canvas (Mobil) and on a published page
- [ ] `component-texts.test.ts` and `component-versions.test.ts` pass
- [ ] The lock file is committed with the change
