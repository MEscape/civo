# Component platform

The `component-platform` module (`src/modules/component-platform`) is the catalog of everything an editor can place on a page: layout, content, civic and smart-city components. It owns what a component **is** (its props, rules and data binding) and how it is **rendered**. It does not own the editor (`builder`), the data (`data-sources`), or the screens of other capabilities (`booking`, `map`): those arrive in its renderer through `composition.ts`.

To add a component, follow [`adding-a-platform-component.md`](../conventions/adding-a-platform-component.md).

## One declaration, three consumers

```text
domain/components/<category>/<name>.component.ts    defineComponent({ type, props, dataBinding, version })
        │
        ├─► builder      palette, properties panel and validation of stored props (through application views)
        ├─► release      pins `version` and the contract versions a component needs
        └─► renderer     parses stored props with the same fields, then calls the implementation
```

Each prop is written once with `prop.*` (`text`, `longText`, `number`, `select`, `switch`, `columns`, `dataset`, `category`, `items`, …). The same declaration gives the TypeScript type of the parsed props, their validation, their default and the control the editor shows. Stored props are parsed **leniently**: an invalid or missing prop takes its default, so a page keeps rendering after a prop was tightened or removed.

`COMPONENT_DEFINITIONS` is an `as const` tuple. `RegisteredComponentName` and `ComponentProps<'type'>` are derived from it, and `COMPONENT_IMPLEMENTATIONS` (presentation) is typed over `RegisteredComponentName`: a definition without an implementation, or the reverse, does not compile.

## Layers

| Layer          | Holds                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Domain         | Component definitions, prop fields, content contracts (`domain/content`), the content source port              |
| Application    | Catalog and release-info queries, content listing, view mappers (`component-platform-view-mappers.ts`)         |
| Infrastructure | The content source adapter that reads datasets through `data-sources`                                          |
| Presentation   | Implementations (`presentation/components/<category>/<name>`), the page renderer, translations (`i18n/*.json`) |

## Data-bound components

A component that shows records declares `dataBinding: { kind }`, a **canonical content kind** (`NewsItem`, `Event`, `SmartCityMetric`, …) defined in `domain/content`. The editor binds a dataset of a compatible kind (`prop.dataset()`); a dataset's field mapping into that kind is owned by `data-sources`. The implementation never fetches: it calls `loadContent`, which returns the records plus their **origin** (`live`, or a labelled `sample`). With no dataset chosen the editor canvas shows sample records and a published page shows an empty state.

Components that need another module's screen (`booking`, `map`) receive it as a service (`RenderServices`), handed in by `composition.ts`; nothing in presentation imports that module.

## Rendering

`renderPageNodes` renders a tree of nodes in one of two modes:

- `published`: a data component streams in behind its skeleton (`<name>.skeleton.tsx`); hidden and unregistered nodes are dropped.
- `draft`: the editor canvas. Nothing streams (the canvas measures nodes by their DOM), every node carries `data-civo-node-id`, hidden nodes stay dimmed.

Every node is wrapped in an error boundary: one failing component never takes the page down. The page's website comes from the render context, never from a prop.

Layouts adapt to the width of their **container**, not the window (`@container` queries), because the editor shows a phone-sized canvas inside a wide window.

## Versions

`version` on a definition is the **implementation version**. A release pins the version of every component it uses; when the current version is higher, the release module offers the website an update (migration) instead of changing a published page silently.

Raise `version` when a change must not reach already published pages unnoticed: a prop added, removed or retyped, children rules changed, the data binding changed, or rendering changed visibly.

A bot cannot decide that, so versions are **enforced, not generated**:

- `scripts/component-version-lock.ts` fingerprints what a stored page can depend on (props, children rules, data binding) and writes `domain/components/component-versions.lock.json`.
- `__tests__/architecture/component-versions.test.ts` fails when a fingerprint changed while `version` did not. It runs in `npm run check` and in CI (`npm run test:architecture`), so a pull request cannot merge with an unnoticed change.
- After raising `version`, run `npm run components:lock` and commit the lock with the change.

Rendering-only changes are not fingerprinted; raise `version` for them by judgement, in the same change.

## Texts

All user-facing text lives in `presentation/i18n/<locale>.json` under `componentPlatform`: `components.<type>.{label,description,fields.<prop>.{label,placeholder,options.<value>}}` for the editor, and one object per component for what it renders. Keys are derived from the type and prop name by `component-platform-view-mappers.ts`; `component-texts.test.ts` fails when a registered component lacks one in any locale. A component may add `components.<type>.sample` (props and children) to give its palette preview content.

## Tests

| What                                            | Where                                                   |
| ----------------------------------------------- | ------------------------------------------------------- |
| Definitions (defaults, parsing, editable props) | `__tests__/src/modules/component-platform`              |
| Every component has its texts                   | `…/application/component-texts.test.ts`                 |
| Versions are raised when a shape changes        | `__tests__/architecture/component-versions.test.ts`     |
| Rendering of a component                        | `__tests__/src/modules/component-platform/presentation` |
