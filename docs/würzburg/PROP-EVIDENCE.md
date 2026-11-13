# Component prop evidence

This is a static prop review of the 29 components registered in
[`component-definitions.ts`](../../src/modules/component-platform/domain/components/component-definitions.ts).
It applies the evidence and change filter in the
[`Designer Agent prompt`](../agents/designer-agent.md). It is not a claim that
all components have been redesigned, tested in a browser, or approved.

## Evidence and migration rules

- **Civic use case** means a concrete municipal task that justifies editor
  configuration. It does not mean a municipal API returned that prop.
- **Source evidence pending** means no reviewed captured record establishes
  the external fields needed by that binding. Synthetic examples must remain
  visibly synthetic.
- **Keep** retains an existing contract. **Optional** means absence must be
  meaningful and must not force invented content. **Generalize** and
  **Deprecate** are change decisions, not claims of completed implementation.
- **None** in the migration column means retain the stored shape. Any actual
  change to shape, accepted variants, defaults, or interpretation requires a
  component version, versioned validation, a stored-JSON migration, one
  previous-version reader, and a migration note. Never delete stored fields
  based on this document alone.
- **Category migration** means preserve existing category strings, accept
  source/config-defined strings, retain the legacy `all` no-filter behavior,
  and migrate only with explicit versioned rules. Source categories must not
  be assigned to invented sustainability/mobility/energy enums.

Captured evidence inspected for this review:

| Reference       | Captured response                                                                                                                                                    | What it establishes                                                                                                                                                                                                                                                                     | What it does not establish                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| PEGEL           | [`pegel-main/response.json`](../../data/fixtures/pegel-main/response.json), [capture metadata](../../data/fixtures/pegel-main/response.meta.json)                    | Station UUID `915d76e1-3bf9-4e37-9a9a-4d144cd771cc` identifies Würzburg. `longitude`, `latitude`, `water.shortname`, `timeseries[].shortname`, `.longname`, `.unit`, `.equidistance`, `.currentMeasurement.timestamp`, `.currentMeasurement.value` and `.characteristicValues[]` exist. | A live connection, history payload, permission to redistribute, or an approved local flood-warning classification.           |
| NINA            | [`nina-wuerzburg/response.json`](../../data/fixtures/nina-wuerzburg/response.json), [capture metadata](../../data/fixtures/nina-wuerzburg/response.meta.json)        | HTTP 200 with `[]` at the recorded instant; a successful empty warning feed is a real state.                                                                                                                                                                                            | Notice title, severity, expiry, instructions or geography fields. No warning record was captured.                            |
| Catalog sitemap | [`wuerzburg-sitemap/response.txt`](../../data/fixtures/wuerzburg-sitemap/response.txt), [capture metadata](../../data/fixtures/wuerzburg-sitemap/response.meta.json) | XML `url/loc` and `url/lastmod`; dataset discovery links include waste, cycling, weather, district statistics and events.                                                                                                                                                               | Those datasets' record schemas, licenses, units, usable geometries, counts or live availability. A link is a discovery lead. |

HTTP capture success is not the same as connection or license approval.
The source register and fixture metadata own capture and reuse status.

## Implemented follow-up, 2026-11-06

PEGELONLINE's linked license and one-day history were subsequently captured and reviewed. The reference uses dated station/measurement snapshots under DL-DE-Zero-2.0, not live telemetry. The observations use `timestamp`/`value`; unit comes from the series. The metadata sample above was the initial evidence boundary, not the current reuse verdict.

| Prop / field                 | Evidence / concrete use case                                                                                                                        | Implemented verdict                                                                                      | Migration                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `section.layout`             | Homepage needs service tasks alongside one Main indicator; mobile must stack.                                                                       | Add optional stack/split/aside using existing primitives.                                                | Section v2; v1 defaults retained; absent field stays stacked.                                 |
| `section.density`            | Compact task/indicator composition needs less nested band padding than standalone topic sections.                                                   | Add optional default/tight/airy using existing spacing tokens.                                           | Section v2; absent field keeps original spacing.                                              |
| `quickLinks.placement`       | Stored public pages need a header navigation, footer and skip-link/main relationship.                                                               | Add optional content/header/footer; only explicit root placements create landmarks.                      | QuickLinks v2; v1 defaults retained; absent field remains content.                            |
| Smart-city `category`        | Captured sources do not establish a universal sustainability/mobility/energy taxonomy; station/series identifiers and source grouping must survive. | Generalize to bounded source/config strings; empty/all still unfiltered.                                 | Five components v2, dashboard v4; previous defaults and reviewable sentinel codemod retained. |
| `SmartCityMetric.observedAt` | Actual `timeseries[].currentMeasurement.timestamp` differs from HTTP capture time.                                                                  | Add optional canonical measurement timestamp, shown separately from capture freshness.                   | Additive content field; missing timestamp remains absent.                                     |
| Dashboard binding metadata   | Independent panels can mix recorded water data and synthetic examples.                                                                              | Preserve all panel provenance and partial status; do not let one KPI failure hide another enabled panel. | Dashboard v4; old panel props retained.                                                       |

Coverage in [03-component-coverage.md](03-component-coverage.md) establishes all registered types in published compositions. It does not upgrade the individual static reviews below to all-state design approval.

## Layout and content

### 1. `section`

Definition: [`section.component.ts`](../../src/modules/component-platform/domain/components/layout/section.component.ts).

| Prop   | Evidence / civic use case                                                                                                                           | Verdict                                                  | Migration                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `tone` | Separate urgent information, service tasks and background information through established surface roles. Existing values are `default` and `muted`. | Keep. Surface changes must preserve text/focus contrast. | None while values and defaults stay unchanged. |

The shared UI already has Container, Grid, Rail, Section and density utilities.
Their existence does not make them independently placeable catalog components.
Stored split/span/rail composition remains a separate implementation decision.

### 2. `accordion`

Definition: [`accordion.component.ts`](../../src/modules/component-platform/domain/components/content/accordion.component.ts).

| Prop               | Evidence / civic use case                                                         | Verdict                                                          | Migration                                         |
| ------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| `heading`          | Identify an appointment-preparation FAQ within a service page.                    | Optional when an enclosing section already supplies the heading. | None if the existing empty-text fallback remains. |
| `items[].question` | Citizen asks which documents to bring or how to cancel an appointment.            | Keep; require a meaningful disclosure label.                     | None.                                             |
| `items[].answer`   | Explain those requirements in accessible text. No external FAQ record is claimed. | Keep.                                                            | None.                                             |

### 3. `callToAction`

Definition: [`call-to-action.component.ts`](../../src/modules/component-platform/domain/components/content/call-to-action.component.ts).

| Prop          | Evidence / civic use case                                                   | Verdict                                                        | Migration                               |
| ------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `heading`     | Identify the next civic task, such as booking a service appointment.        | Keep.                                                          | None.                                   |
| `body`        | Explain prerequisites only when the action needs context.                   | Optional; do not require promotional copy.                     | None if empty text retains its meaning. |
| `buttonLabel` | A named action such as “Termin auswählen” must communicate its destination. | Keep; never derive the accessible name solely from decoration. | None.                                   |
| `href`        | Navigate to the website's appointment or participation page.                | Keep; validated internal paths preferred.                      | None.                                   |

### 4. `cardGrid`

Definition: [`card-grid.component.ts`](../../src/modules/component-platform/domain/components/content/card-grid.component.ts).

| Prop                  | Evidence / civic use case                                                      | Verdict                                                                     | Migration                               |
| --------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------- |
| `heading`             | Label a collection of civic topic pages.                                       | Optional with an existing section label.                                    | None if existing fallback is preserved. |
| `cards[].title`       | Name a destination such as education, building permits or culture.             | Keep.                                                                       | None.                                   |
| `cards[].description` | Distinguish destinations when titles alone are insufficient.                   | Keep optional.                                                              | None.                                   |
| `cards[].href`        | Linked topic cards navigate; informational cards need no invented destination. | Keep optional.                                                              | None.                                   |
| `columns`             | Adapt topic density to card count and available container width.               | Keep bounded responsive choices; never force four narrow columns on mobile. | None.                                   |

### 5. `hero`

Definition: [`hero.component.ts`](../../src/modules/component-platform/domain/components/content/hero.component.ts), current declared version 2.

| Prop       | Evidence / civic use case                                                                                                           | Verdict                                                          | Migration                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `title`    | State the page's civic task and provide its principal heading.                                                                      | Keep.                                                            | None.                                                                                                         |
| `subtitle` | Explain scope or eligibility without repeating the title.                                                                           | Optional.                                                        | None if existing empty value remains valid.                                                                   |
| `image`    | Select a licensed, self-hosted municipal illustration from the media library. No usable Würzburg image license is established here. | Keep optional; source/asset evidence pending.                    | None.                                                                                                         |
| `imageUrl` | Legacy external image fallback exists in stored pages; direct third-party image loads conflict with the requested privacy default.  | Deprecate new external-URL authoring in favor of licensed media. | Versioned asset import/consent strategy; retain a reader for existing v2 pages. Do not silently discard URLs. |

### 6. `richText`

Definition: [`rich-text.component.ts`](../../src/modules/component-platform/domain/components/content/rich-text.component.ts).

| Prop      | Evidence / civic use case                                                                                                                 | Verdict                                                   | Migration                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| `heading` | Identify legal, accessibility or service-preparation text within a page.                                                                  | Optional when page structure already identifies the text. | None if fallback behavior is retained. |
| `body`    | Explain fees, required documents, demonstration legal text or a council process. Civic editorial content is not an external-source claim. | Keep; validate text and preserve accessible structure.    | None.                                  |

### 7. `tabs`

Definition: [`tabs.component.ts`](../../src/modules/component-platform/domain/components/content/tabs.component.ts).

| Prop           | Evidence / civic use case                                                                               | Verdict                                                     | Migration |
| -------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------- |
| `tabs[].label` | Switch between closely related service information that citizens compare, such as preparation and fees. | Keep; essential task instructions must remain discoverable. | None.     |
| `tabs[].body`  | Supply the associated explanation. Source-derived fees remain pending; invented fees must be synthetic. | Keep.                                                       | None.     |

## Civic components

### 8. `alertBanner`

Definition: [`alert-banner.component.ts`](../../src/modules/component-platform/domain/components/civic/alert-banner.component.ts).

| Prop        | Evidence / civic use case                                                                                                  | Verdict                                        | Migration                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| `datasetId` | Select the website's notices dataset. NINA `[]` establishes a valid empty response, not a compatible Alert record mapping. | Keep; populated source-field evidence pending. | None.                                                                      |
| `heading`   | Name current civic notices without implying an emergency when none exists.                                                 | Optional with a sensible localized default.    | None.                                                                      |
| `limit`     | Bound notices so an urgent item remains visible without an unbounded feed.                                                 | Keep; preserve access to additional notices.   | None; later DataWindow adoption needs a version if interpretation changes. |

Do not fabricate a NINA warning to fill an empty response. Warning severity,
instruction and expiry mappings require a populated permitted fixture.

### 9. `booking`

Definition: [`booking.component.ts`](../../src/modules/component-platform/domain/components/civic/booking.component.ts), current declared version 2.

| Prop        | Evidence / civic use case                                                                                      | Verdict                                            | Migration                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `heading`   | Identify a booking task such as a fictional Bürgerbüro appointment.                                            | Keep optional default.                             | None.                                           |
| `serviceId` | Narrow a service-detail page to an existing website-scoped bookable service.                                   | Keep optional for the general booking entry point. | None; never introduce a tenant identifier prop. |
| `category`  | Filter services using categories owned by the tenant's booking data. This is not the smart-city category enum. | Keep optional and data-driven.                     | None while stored values retain their meaning.  |

Capacity, scheduling, state transitions and staff permissions belong to the
booking module. They must not become unchecked public component props.

### 10. `contactCard`

Definition: [`contact-card.component.ts`](../../src/modules/component-platform/domain/components/civic/contact-card.component.ts).

| Prop        | Evidence / civic use case                                                                                                                                               | Verdict        | Migration |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------- |
| `datasetId` | Select a tenant contact record for the office responsible for a service. Contact field response evidence is pending; demo people and contact details must be fictional. | Keep.          | None.     |
| `heading`   | Distinguish the responsible office from other contact information.                                                                                                      | Keep optional. | None.     |

### 11. `councilBlock`

Definition: [`council-block.component.ts`](../../src/modules/component-platform/domain/components/civic/council-block.component.ts).

| Prop        | Evidence / civic use case                                                                                                       | Verdict                                      | Migration |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------- |
| `datasetId` | Select council bodies for residents researching who decides an issue. No populated OParl fixture is established by this review. | Keep; body/member response evidence pending. | None.     |
| `heading`   | Identify the council or committee directory.                                                                                    | Keep optional.                               | None.     |

Body display is not evidence that meetings, agenda items, papers and decisions
are already supported by this component.

### 12. `departmentDirectory`

Definition: [`department-directory.component.ts`](../../src/modules/component-platform/domain/components/civic/department-directory.component.ts).

| Prop        | Evidence / civic use case                                                                                       | Verdict        | Migration |
| ----------- | --------------------------------------------------------------------------------------------------------------- | -------------- | --------- |
| `datasetId` | Find the department responsible for an administrative service. Public organization response fields are pending. | Keep.          | None.     |
| `heading`   | Label the administration directory in context.                                                                  | Keep optional. | None.     |
| `columns`   | Permit a compact directory or wider descriptive entries using existing responsive bounds.                       | Keep.          | None.     |

### 13. `eventsGrid`

Definition: [`events-grid.component.ts`](../../src/modules/component-platform/domain/components/civic/events-grid.component.ts).

| Prop        | Evidence / civic use case                                                                                                                   | Verdict                                               | Migration                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| `datasetId` | Residents find upcoming cultural or civic events. Sitemap `url/loc` includes `eventfeed`; this does not prove Event response compatibility. | Keep; event field evidence pending.                   | None.                                         |
| `heading`   | Name the event collection and its context.                                                                                                  | Keep optional.                                        | None.                                         |
| `limit`     | Bound the initial list while allowing further events to be found.                                                                           | Keep; date-range windowing is a separate enhancement. | None until semantics change.                  |
| `category`  | Scope a page to source/config-defined events. No captured event records prove a fixed category taxonomy.                                    | Keep optional opaque text; no new category enum.      | None if existing free-text values stay valid. |
| `columns`   | Match event-card density to container width.                                                                                                | Keep.                                                 | None.                                         |

### 14. `newsAndEventsSplit`

Definition: [`news-and-events-split.component.ts`](../../src/modules/component-platform/domain/components/civic/news-and-events-split.component.ts).

| Prop              | Evidence / civic use case                                                                                             | Verdict                                           | Migration |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------- |
| `newsDatasetId`   | Place editorial news beside upcoming events on the start page. No verified NewsItem source-field mapping is asserted. | Keep independent binding.                         | None.     |
| `eventsDatasetId` | Events can come from another source than news; sitemap `eventfeed` is only a lead.                                    | Keep independent binding; field evidence pending. | None.     |
| `heading`         | Explain the combined region without duplicating both child labels.                                                    | Keep optional.                                    | None.     |
| `newsLimit`       | Bound recent news independently from events.                                                                          | Keep.                                             | None.     |
| `eventsLimit`     | Bound upcoming events independently from news.                                                                        | Keep.                                             | None.     |

### 15. `newsGrid`

Definition: [`news-grid.component.ts`](../../src/modules/component-platform/domain/components/civic/news-grid.component.ts).

| Prop        | Evidence / civic use case                                                                                | Verdict                                                    | Migration |
| ----------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------- |
| `datasetId` | Publish civic updates such as temporary office closure information. News response fields remain pending. | Keep.                                                      | None.     |
| `heading`   | Identify recent news or a topic-specific bulletin.                                                       | Keep optional.                                             | None.     |
| `limit`     | Keep a bounded initial reading list.                                                                     | Keep.                                                      | None.     |
| `category`  | Filter according to the editorial source/config, which may have no categories.                           | Keep optional free text; source taxonomy evidence pending. | None.     |
| `columns`   | Support one lead story and compact news collections at responsive widths.                                | Keep.                                                      | None.     |

### 16. `openingHours`

Definition: [`opening-hours.component.ts`](../../src/modules/component-platform/domain/components/civic/opening-hours.component.ts).

| Prop        | Evidence / civic use case                                                                                       | Verdict                          | Migration |
| ----------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------- |
| `datasetId` | Check whether an office is open before visiting. No captured hours response establishes holidays or exceptions. | Keep; response evidence pending. | None.     |
| `heading`   | State which office's hours are shown.                                                                           | Keep optional.                   | None.     |

An hours list does not prove support for dated exceptions, holidays or slot
generation. Those require explicit data and scheduling behavior.

### 17. `quickLinks`

Definition: [`quick-links.component.ts`](../../src/modules/component-platform/domain/components/civic/quick-links.component.ts).

| Prop            | Evidence / civic use case                                                          | Verdict                                       | Migration |
| --------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- | --------- |
| `heading`       | Identify top citizen tasks or useful links within a topic page.                    | Keep optional.                                | None.     |
| `links[].label` | Name a task such as selecting an appointment or reporting an issue.                | Keep.                                         | None.     |
| `links[].href`  | Point to an actual navigable stored page or a clearly identified external service. | Keep; never seed a dead action as functional. | None.     |

### 18. `serviceFinder`

Definition: [`service-finder.component.ts`](../../src/modules/component-platform/domain/components/civic/service-finder.component.ts).

| Prop              | Evidence / civic use case                                                                                     | Verdict                                 | Migration                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `datasetId`       | Find an administrative procedure and its requirements. No captured service record proves fee/document fields. | Keep; source-field evidence pending.    | None.                                                   |
| `heading`         | Name the service search.                                                                                      | Keep optional.                          | None.                                                   |
| `description`     | Explain the service coverage when its scope is otherwise unclear.                                             | Optional; avoid redundant helper text.  | None.                                                   |
| `placeholder`     | Suggest a search example; it must not replace a persistent label.                                             | Keep optional with a localized default. | None.                                                   |
| `initialCategory` | Start a topic page within a source-defined service grouping. Ungrouped sources must work.                     | Keep optional and data-driven.          | None if the current empty/default behavior is retained. |

### 19. `serviceGrid`

Definition: [`service-grid.component.ts`](../../src/modules/component-platform/domain/components/civic/service-grid.component.ts).

| Prop        | Evidence / civic use case                                                                               | Verdict        | Migration |
| ----------- | ------------------------------------------------------------------------------------------------------- | -------------- | --------- |
| `datasetId` | Offer a compact set of related administrative services. External service shape remains unverified here. | Keep.          | None.     |
| `heading`   | Identify the related services.                                                                          | Keep optional. | None.     |
| `columns`   | Fit concise services or longer German titles without losing responsive stacking.                        | Keep.          | None.     |

### 20. `wasteCalendar`

Definition: [`waste-calendar.component.ts`](../../src/modules/component-platform/domain/components/civic/waste-calendar.component.ts).

| Prop                   | Evidence / civic use case                                                                                                                                         | Verdict                                                                   | Migration                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `datasetId`            | Find upcoming collection dates. Sitemap `url/loc` includes `abfallkalender-wuerzburg`; response date/address fields remain pending.                               | Keep.                                                                     | None.                                                                        |
| `additionalDatasetIds` | Combine separate tenant datasets when districts or waste streams are delivered separately. This is a civic integration use case, not a verified source partition. | Keep optional and bounded.                                                | None.                                                                        |
| `heading`              | Identify the collection calendar.                                                                                                                                 | Keep optional.                                                            | None.                                                                        |
| `district`             | Narrow results to a source-defined collection area; do not assume every source groups by administrative district.                                                 | Generalize semantics to source-defined area/filter when evidence arrives. | Required if renamed or interpretation changes; preserve old district values. |
| `limit`                | Bound the next collections displayed.                                                                                                                             | Keep; eventual date horizon belongs to DataWindow.                        | None until semantics change.                                                 |

## Smart-city and map components

### 21. `dashboardGrid`

Definition: [`dashboard-grid.component.ts`](../../src/modules/component-platform/domain/components/smartcity/dashboard-grid.component.ts), current declared version 3.

| Prop                 | Evidence / civic use case                                                                                                                              | Verdict                                                | Migration                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------- |
| `datasetId`          | Select indicators. PEGEL supplies several independent measured quantities with different units; it does not supply a SmartCityMetric payload directly. | Keep; mapping must retain units and timestamps.        | None for binding; canonical record migration may be separate. |
| `trendDatasetId`     | Show a selected measurement through time when history is available. Captured PEGEL station response contains current measurements only.                | Keep optional; history evidence pending.               | None.                                                         |
| `breakdownDatasetId` | Show an approved statistical or budget composition alongside indicators. Captured evidence does not establish a breakdown response.                    | Keep optional; source evidence pending.                | None.                                                         |
| `heading`            | Label a dashboard chosen by the tenant.                                                                                                                | Keep optional.                                         | None.                                                         |
| `limit`              | Bound the records each data view can request.                                                                                                          | Keep; generalize budget semantics through DataWindow.  | Required if one limit becomes multiple window policies.       |
| `category`           | PEGEL groups stations by `water.shortname` and quantities by `timeseries[].shortname`; neither supplies the old civic-domain enum.                     | Generalize to optional source/config-defined grouping. | Category migration required.                                  |
| `showKpis`           | A measurement overview may need values without a chart.                                                                                                | Keep; ensure at least one useful child remains.        | None.                                                         |
| `showTrend`          | A source with no history must not imply a trend.                                                                                                       | Keep; disable/omit absent history.                     | None.                                                         |
| `showBreakdown`      | A source with no additive composition must not imply one.                                                                                              | Keep; omit absent breakdown.                           | None.                                                         |
| `columns`            | Adapt indicator density to one or many indicators and available width.                                                                                 | Keep bounded responsive choices.                       | None.                                                         |

### 22. `kpiGrid`

Definition: [`kpi-grid.component.ts`](../../src/modules/component-platform/domain/components/smartcity/kpi-grid.component.ts).

| Prop        | Evidence / civic use case                                                                                                      | Verdict                                 | Migration                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ---------------------------- |
| `datasetId` | PEGEL `.currentMeasurement.value`, `.unit`, `.timestamp` support a current measured-value presentation after explicit mapping. | Keep; never hide units or date.         | None for binding.            |
| `heading`   | Name the indicator group using tenant copy.                                                                                    | Keep optional.                          | None.                        |
| `category`  | Source grouping may be quantity, place, tag or absent. No captured evidence supports hard-coded domain categories.             | Generalize to optional opaque grouping. | Category migration required. |
| `columns`   | One water-level indicator and several environmental indicators need different density.                                         | Keep.                                   | None.                        |

### 23. `map`

Definition: [`map.component.ts`](../../src/modules/component-platform/domain/components/smartcity/map.component.ts), current declared version 2.

| Prop                 | Evidence / civic use case                                                                                                                                      | Verdict                                                                | Migration                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `savedMapId`         | Reuse one website-owned map across topic pages while freezing it into published releases.                                                                      | Keep; preferred authoring binding.                                     | None.                                                                             |
| `primaryDatasetId`   | Existing inline maps bind geographic records; PEGEL `longitude`/`latitude` support station points after mapping.                                               | Deprecate new inline authoring in favor of saved maps; retain reads.   | Versioned migration to a website-scoped saved map; preserve v2 release snapshots. |
| `secondaryDatasetId` | Combine another explicitly selected compatible geographic layer. No second compatible record source is established in this review.                             | Keep optional for legacy reads; field evidence pending.                | Same inline-to-saved-map migration if authoring changes.                          |
| `heading`            | Give the geographic view an accessible contextual name.                                                                                                        | Keep.                                                                  | None.                                                                             |
| `limit`              | Bound point/layer payload; full-catalog or 40,000-tree loading must not happen unbounded in the browser.                                                       | Keep for legacy reads; use map/source window budgets.                  | Required if semantics move entirely into saved-map policy.                        |
| `pointStyle`         | Mark a station, cluster many facilities, or show density. Only station-point evidence is established by PEGEL here; density is a civic visualization use case. | Keep existing variants; use density only with a documented count/unit. | None.                                                                             |
| `colorBy`            | Encode a mapped attribute when meaningful and accompanied by labels/legend. PEGEL quantity labels are not a license to mix unlike values.                      | Keep optional, chosen from actual fields.                              | None.                                                                             |
| `sizeBy`             | Encode a comparable numeric count or magnitude; no captured data proves a tree-density field.                                                                  | Keep optional; source evidence required per map.                       | None.                                                                             |
| `interaction`        | Allow a citizen to inspect details, follow a feature link or read a noninteractive overview.                                                                   | Keep.                                                                  | None.                                                                             |
| `height`             | A contact location and a map explorer need different bounded space.                                                                                            | Keep existing steps.                                                   | None.                                                                             |
| `showFilters`        | Filter only dimensions available in the configured data.                                                                                                       | Keep; hide absent filters.                                             | None.                                                                             |
| `showLegend`         | Explain the actual visual encoding; never use color alone.                                                                                                     | Keep; do not show a meaningless legend.                                | None.                                                                             |

OGC overlays, time playback, privacy-compliant self-hosted tiles and a print
alternative need separate implementation and browser verification. Existing
point/line/polygon support does not prove those requirements.

### 24. `metricChart`

Definition: [`metric-chart.component.ts`](../../src/modules/component-platform/domain/components/smartcity/metric-chart.component.ts).

| Prop        | Evidence / civic use case                                                                                                             | Verdict                                            | Migration                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| `datasetId` | Compare quantities only within a common unit. PEGEL demonstrates heterogeneous `timeseries[].unit`; existing renderer groups by unit. | Keep; do not invent a common axis for cm and m³/s. | None.                        |
| `heading`   | Describe the comparison and its scope.                                                                                                | Keep optional.                                     | None.                        |
| `category`  | Source/config owns grouping, not an enum of civic topics.                                                                             | Generalize to optional opaque grouping.            | Category migration required. |

### 25. `metricComparisonChart`

Definition: [`metric-comparison-chart.component.ts`](../../src/modules/component-platform/domain/components/smartcity/metric-comparison-chart.component.ts).

| Prop        | Evidence / civic use case                                                                                                                  | Verdict                                                         | Migration                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------- |
| `datasetId` | Compare actual progress with a documented municipal target. No captured source proves an adopted policy target; examples remain synthetic. | Keep for that civic use case; target response evidence pending. | None.                        |
| `heading`   | Identify the policy/period being compared.                                                                                                 | Keep optional.                                                  | None.                        |
| `category`  | A target program can have any tenant-defined label or no group.                                                                            | Generalize to optional opaque grouping.                         | Category migration required. |

PEGEL historical maxima and navigation reference values are not adopted
municipal policy goals. Do not map them into a target-progress chart silently.

### 26. `metricDonut`

Definition: [`metric-donut.component.ts`](../../src/modules/component-platform/domain/components/smartcity/metric-donut.component.ts).

| Prop        | Evidence / civic use case                                                                                                            | Verdict                                                 | Migration                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------ |
| `datasetId` | Display a valid whole-and-parts composition, such as a documented spending breakdown. No captured composition record is established. | Keep for named civic use case; source evidence pending. | None.                                                        |
| `heading`   | Name the whole, area and period the parts describe.                                                                                  | Keep optional.                                          | None.                                                        |
| `limit`     | Bound returned categories without presenting an incomplete set as 100% of a whole.                                                   | Keep; require explicit partial-data treatment.          | Required if aggregation into an “other” group is introduced. |
| `group`     | Select one source/config composition; it is not a fixed civic category.                                                              | Keep optional free text.                                | None.                                                        |

### 27. `metricGauge`

Definition: [`metric-gauge.component.ts`](../../src/modules/component-platform/domain/components/smartcity/metric-gauge.component.ts).

| Prop        | Evidence / civic use case                                                                                                                               | Verdict                                                                                              | Migration                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `datasetId` | Existing gauge shows progress toward a target. PEGEL instead provides observations and named `characteristicValues[]` with validity/period information. | Keep for progress; generalize via a threshold variant only after a contract decision.                | Required for a new interpretation/variant; old progress data must remain progress. |
| `heading`   | Distinguish a policy target from a raw water-level reading.                                                                                             | Keep optional.                                                                                       | None.                                                                              |
| `goalId`    | Select one goal from the bound dataset.                                                                                                                 | Keep optional for progress; a threshold selection must not reuse this name with different semantics. | Required if introducing a separate observation/threshold binding.                  |

The existing percentage gauge clamps progress to 0–100%. It is not yet a
water-level warning display. A threshold variant must keep the absolute unit,
observation time, reference label and validity period; do not invent alarm stages.

### 28. `metricTable`

Definition: [`metric-table.component.ts`](../../src/modules/component-platform/domain/components/smartcity/metric-table.component.ts).

| Prop        | Evidence / civic use case                                                                                                  | Verdict                                                        | Migration                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------- |
| `datasetId` | Read precise indicator values and units in text. PEGEL measured quantities provide a real motivation for this alternative. | Keep; do not represent it as a generic document/dataset table. | None.                        |
| `heading`   | Identify the table's subject and scope.                                                                                    | Keep optional.                                                 | None.                        |
| `category`  | Filter according to actual source/config grouping.                                                                         | Generalize to optional opaque grouping.                        | Category migration required. |

### 29. `metricTrendChart`

Definition: [`metric-trend-chart.component.ts`](../../src/modules/component-platform/domain/components/smartcity/metric-trend-chart.component.ts).

| Prop        | Evidence / civic use case                                                                                                                                                         | Verdict                                                                          | Migration                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `datasetId` | Read observations through time. PEGEL provides current `.timestamp`, `.value`, `.unit` and declared `.equidistance`; the captured station response does not contain history rows. | Keep; history and aggregation evidence pending.                                  | None for binding.                                     |
| `heading`   | State the quantity and temporal context.                                                                                                                                          | Keep optional.                                                                   | None.                                                 |
| `limit`     | Existing chart bounds records requested; large histories need a reusable window and hard point budget.                                                                            | Keep; generalize through DataWindow rather than silently ignoring the old limit. | Required when stored-window policy changes behavior.  |
| `series`    | Choose a particular quantity/station series. PEGEL `timeseries[].shortname` and station UUID supply real series identity, after explicit mapping.                                 | Keep optional source-derived selection.                                          | None unless identifiers or selector semantics change. |
| `category`  | The source has quantity/water groupings and may have no civic-domain category.                                                                                                    | Generalize to optional opaque grouping.                                          | Category migration required.                          |

## Implementation and review status

| Scope                                                                                                          | Status of this document                                                               | Remaining evidence or implementation                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| All 29 registered components and their listed props                                                            | Static definition inventory and prop-level decision recorded above.                   | Renderer behavior must still be verified for each accepted decision.                                                    |
| Category generalization                                                                                        | Design decision supported by PEGEL structure and the absence of a universal taxonomy. | Check the final versioned implementation, migrations and regression tests; this table is not proof of their completion. |
| External fields for events, news, services, contacts, departments, council, hours, waste, goals and breakdowns | Source evidence pending in this review.                                               | Inspect permitted captured payloads, not sitemap slugs; update field-specific mappings and fixtures.                    |
| New layout catalog entries                                                                                     | Not implemented by this document.                                                     | Reuse shared primitives first; prove which stored composition capabilities actual pages need.                           |
| Map overlays/time/privacy/printing                                                                             | Not verified by this document.                                                        | Implement missing behavior and run browser, keyboard, print and request-privacy checks.                                 |
| Booking states, capacity and citizen journey                                                                   | Not verified by this document.                                                        | Verify application state machine and full public/staff flows; no waitlist claim.                                        |
| Whole-catalog visual/accessibility review, all states and brands                                               | Not Verified.                                                                         | Runtime evidence at the required viewports, contrast matrix, forced colors, keyboard and screen reader checks.          |

No prop is removed merely because an external API does not contain an editor
setting. Conversely, a named civic use case does not authorize fabricating a
real source record, official contact, fee, target, warning or opening hour.

## Source-backed follow-up: current catalog has 30 components

### 30. `statusBoard` (version 1)

| Prop        | Evidence / civic use case                                                                                                       | Verdict                                                                             | Migration                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `datasetId` | City parking response provides `id`, `name`, `status`, `values_from`. It provides no capacity or reliable coordinates.          | Keep; bind GeoFeature name/status/observedAt without requiring geometry.            | New version-1 component; separate parking dataset ID preserves older service-shaped releases. |
| `heading`   | Identify the subject of a set of source-defined place statuses.                                                                 | Keep optional, translated default.                                                  | None.                                                                                         |
| `limit`     | A bounded source window contains repeated facility observations; ingestion retains each facility's newest supplied observation. | Keep bounded by existing dataset limits and the source's configured refresh policy. | None.                                                                                         |

No free-space count, invented occupancy percentage, fixed status enum or location prop was added. Missing/blank status and missing observation time have text alternatives. Source refresh runs server-side; rendering this component does not initiate browser polling.

### Corrections supported by complete responses

| Contract / behavior      | Evidence                                                                                                                           | Verdict / migration                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waste `wasteType`        | The complete 2,600-record export includes Wertstoffmobil and Christbaumabfuhr alongside Biomüll, Papier, Restmüll and Gelbe Säcke. | Preserve exact bounded source text under waste content/calendar v2; legacy stored keys remain readable. Re-ingest historically misclassified values. |
| Observation `resolution` | Bicycle `dayofyear` is a date-only daily bucket; gauge measurements have actual offset timestamps.                                 | Optional `P1D` metadata controls calendar-date formatting; missing metadata retains instant formatting. No public component-prop shape changes.      |
| Chart initial range      | The actual one-day gauge response contains 96 observations, fewer than the editor's 500-record limit.                              | Bound a complete initial window to available records so the first zoom changes the visible range. No stored-prop rewrite.                            |
| Map budgets              | Spatial fallback exceeded the source's declared 500-record maximum and failed at runtime.                                          | Propagate the source maximum to spatial reads; existing sources without a hint retain compatibility.                                                 |
| Map identity             | External website/dataset IDs are opaque strings in their owning modules.                                                           | Accept those IDs up to 128 characters; map-owned IDs stay UUIDs. No stored-prop rewrite.                                                             |
| Freshness                | Actual capture metadata plus an explicit per-source refresh interval.                                                              | Shared attribution displays capture time and overdue refresh, independently of observation time. No invented measurement date.                       |
| Place identity           | The toilet response contains nine exact duplicate IDs/values: 96 rows describe 87 distinct locations.                              | Remove only identical projected duplicates. Conflicting identities fail validation; preserve raw evidence.                                           |
| Contact-map location     | Captured Wikidata Q98486869 supplies Rathaus name and Earth coordinates under the reviewed CC0 structured-data policy.             | Bind the actual building point alongside district context. No entrance, street-routing or accuracy claim is inferred.                                |

The partial tree sample and obsolete weather series are internal contract-review material. They no longer occupy public pages merely to demonstrate a component.
