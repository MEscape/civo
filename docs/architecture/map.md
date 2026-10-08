# Map

The map is a **renderer of geographic data**, not a data source. The `map` module (`src/modules/map`) turns layers of located records into an accessible, filterable, Mapbox-backed view. It never fetches, stores or authorizes data.

## Who owns what

| Concern                                                                                 | Owner                                |
| --------------------------------------------------------------------------------------- | ------------------------------------ |
| Which datasets a page uses, editor UI, page composition                                 | Component Platform (`map` component) |
| Connecting, fetching, mapping, caching, credentials, authorization                      | Data Sources                         |
| Validating features, colour/size encoding, filters, legend, selection, viewport, Mapbox | Map module                           |

```text
Admin binds datasets ─► Component Platform (`map` component, GeoFeature / SmartCityMetric contracts)
                              │  MapLayerInput[] + MapConfig
                              ▼
Map module  BuildMapModel (server): validate → profile fields → style → filters
                              │  MapModel (plain, serializable)
                              ▼
MapExplorer (client): filters · legend · details · list ─► MapRenderer ─► Mapbox GL JS
```

The component platform never imports the map at runtime: its `composition.ts` hands `MapSection` (the map module's public API, wired in the map's own `composition.ts` with a logging `DataIssueReporter`) to the page renderer, and the `map` component renders what it is given.

Mapbox is confined to `presentation/mapbox/`. `mapbox-layers.ts` turns a `LayerStyle` into Mapbox layers and expressions; `create-mapbox-renderer.ts` is the only file that imports `mapbox-gl`, and only when a map is shown (dynamic import).

## Connecting data (admin)

The editor binds **existing datasets**; there are no URLs in the component.

| Prop                                     | Accepts                          | Use                                                                        |
| ---------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `primaryDatasetId`, `secondaryDatasetId` | canonical kind `GeoFeature`      | Any located thing: points, lines, areas                                    |
| `metricsDatasetId`                       | canonical kind `SmartCityMetric` | The same dataset that feeds dashboards, once it has `latitude`/`longitude` |

Nothing chosen: the editor canvas shows labelled sample features, a published page shows an empty map.

`GeoFeature` fields (map them in the dataset's mapping): `name` (required), `geometry` (a GeoJSON geometry object) **or** `latitude` + `longitude`, `category`, `status`, `value`, `unit`, `observedAt`, `description`, `href`, and `properties` (map a whole source object here; every scalar in it becomes a field the map can colour, size, filter and show, e.g. `species`, `bikeCount`).

A REST endpoint that returns a GeoJSON `FeatureCollection` is read as a list of its features, so map `geometry` and `properties.<name>` straight from the feature.

## Configuration

| Prop                                  | Meaning                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pointStyle`                          | `circles` (sized by data), `markers`, `clusters`, `heatmap`. Lines and areas always draw as lines and areas                                     |
| `colorBy`                             | Any attribute name. Empty: `status`, then `category`, else one colour per layer. Text → categories (max 6, rest "other"); number → colour range |
| `sizeBy`                              | Numeric attribute for circle size / heatmap intensity. Empty: `value` if it varies                                                              |
| `interaction`                         | `details` (panel), `link` (open the feature's `href`, details if it has none), `none`                                                           |
| `height`, `showFilters`, `showLegend` | Presentation                                                                                                                                    |

A configured attribute a layer does not have is not an error: that layer picks its own. This is what lets one map mix datasets from different sources.

## Behaviour worth knowing

- **Filters** are derived from the data, not configured: a text/boolean attribute with 2–12 values becomes a checkbox group, a varying number a min/max range, a date attribute a date range. At most 4. A filter only constrains layers that have its field.
- **Legend** is built from the same `LayerStyle` objects the Mapbox layers are built from. Entries are words with counts; swatches also vary by geometry (dot, line, area), so colour is never the only channel.
- **Accessibility**: the list below the map contains every location that passes the filters and is fully usable by keyboard and screen reader; selection is exposed with `aria-pressed` and a polite live region; filters are labelled fieldsets; the canvas uses cooperative gestures so it never traps page scroll; reduced motion is respected.
- **Invalid data**: a feature without a usable geometry (missing, unsupported, out-of-range, too large, duplicate id) is dropped, counted by reason, shown to visitors as text and logged once as a warning. The rest is drawn.
- **Size limits**: Data Sources caps a dataset at 1000 records; a geometry is capped at 10 000 positions. Larger sources need server-side filtering or vector tiles, which `MapRenderer` does not preclude (a tile source would be another source type behind the same interface) but which is not built.
- **Degradation**: without a token, or if WebGL/Mapbox fails, the map background is replaced by a notice and everything else (filters, legend, list, details) keeps working.

## Configuration of Mapbox

| Variable                          |                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox **public** token (`pk.…`), URL-restricted in the Mapbox account. Optional |
| `NEXT_PUBLIC_MAPBOX_STYLE_URL`    | `mapbox://styles/<owner>/<style>`, default `mapbox://styles/mapbox/light-v11`    |

If a Content-Security-Policy is added later, Mapbox GL needs `worker-src blob:`, `child-src blob:`, `img-src data: blob:` and `connect-src` for `*.mapbox.com`.

## Extending

- New point visualization: add to `POINT_STYLES` and a branch in `pointLayers` (`mapbox-layers.ts`); the legend and styles need no change unless it has a new encoding.
- New filter type: a variant in `filters.ts` (`FilterDefinition`, `FilterValue`) and a control in `map-filters.tsx`.
- Another field type that should be visible on the map: add it to the `GeoFeature` contract (additive changes do not bump the version).
