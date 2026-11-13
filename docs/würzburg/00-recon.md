# M0: repository reconnaissance

Capture date: 2026-11-06. Evidence: inspected source and actual baseline commands. Runtime and visual claims are limited by `NOT-VERIFIED.md`.

## Product and architecture

Civo is a Next.js App Router municipal website builder. A website is a tenant. Business capabilities live in modules with domain/application/infrastructure/presentation layers. Public pages must use builder trees and published release snapshots; no city-specific renderer is needed.

The supplied Designer Agent prompt is `docs/agents/designer-agent.md`. Its actual sections govern review judgment; references in the master prompt to absent section numbers do not establish nonexistent tokens or APIs.

## Component inventory

All definitions are under `src/modules/component-platform/domain/components/`. The custom `prop` validators and `defineComponent` are the existing schema system. Restoration supplies defaults for individual invalid/missing fields; this is not permission to silently change stored contracts.

| Group      | Component             | Version | Props                                                                                                                                       | Binding and variants                                                                   |
| ---------- | --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Layout     | section               | 1       | tone                                                                                                                                        | children; default/muted                                                                |
| Content    | hero                  | 2       | title, subtitle, image, imageUrl                                                                                                            | media ID; legacy remote-image fallback                                                 |
| Content    | richText              | 1       | heading, body                                                                                                                               | static paragraphs                                                                      |
| Content    | cardGrid              | 1       | heading, cards, columns                                                                                                                     | title/description/href; max 24 cards                                                   |
| Content    | callToAction          | 1       | heading, body, buttonLabel, href                                                                                                            | static action                                                                          |
| Content    | accordion             | 1       | heading, items                                                                                                                              | question/answer; max 30                                                                |
| Content    | tabs                  | 1       | tabs                                                                                                                                        | label/body; max 12                                                                     |
| Civic      | alertBanner           | 1       | datasetId, heading, limit                                                                                                                   | Alert; limit 1–10                                                                      |
| Civic      | contactCard           | 1       | datasetId, heading                                                                                                                          | Contact                                                                                |
| Civic      | councilBlock          | 1       | datasetId, heading                                                                                                                          | CouncilBody                                                                            |
| Civic      | departmentDirectory   | 1       | datasetId, heading, columns                                                                                                                 | Department                                                                             |
| Civic      | eventsGrid            | 1       | datasetId, heading, limit, category, columns                                                                                                | Event; limit 1–24                                                                      |
| Civic      | newsGrid              | 1       | datasetId, heading, limit, category, columns                                                                                                | NewsItem; limit 1–24                                                                   |
| Civic      | newsAndEventsSplit    | 1       | newsDatasetId, eventsDatasetId, heading, newsLimit, eventsLimit                                                                             | NewsItem + Event; limit 1–12 each                                                      |
| Civic      | openingHours          | 1       | datasetId, heading                                                                                                                          | OpeningHoursEntry                                                                      |
| Navigation | quickLinks            | 1       | heading, links                                                                                                                              | civic catalog group; label/href, max 30                                                |
| Civic      | serviceFinder         | 1       | datasetId, heading, description, placeholder, initialCategory                                                                               | ServiceDetail; source-derived category search                                          |
| Civic      | serviceGrid           | 1       | datasetId, heading, columns                                                                                                                 | Service                                                                                |
| Civic      | wasteCalendar         | 1       | datasetId, additionalDatasetIds, heading, district, limit                                                                                   | WasteCollectionEntry; 8 extra datasets, limit 1–50                                     |
| Bookings   | booking               | 2       | heading, serviceId, category                                                                                                                | booking-module service selection; singleton                                            |
| Smart city | dashboardGrid         | 3       | datasetId, trendDatasetId, breakdownDatasetId, heading, limit, category, showKpis, showTrend, showBreakdown, columns                        | metrics + observations + distribution                                                  |
| Smart city | kpiGrid               | 1       | datasetId, heading, category, columns                                                                                                       | SmartCityMetric                                                                        |
| Smart city | metricChart           | 1       | datasetId, heading, category                                                                                                                | SmartCityMetric; bars                                                                  |
| Smart city | metricComparisonChart | 1       | datasetId, heading, category                                                                                                                | SmartCityGoal                                                                          |
| Smart city | metricDonut           | 1       | datasetId, heading, limit, group                                                                                                            | SmartCityBreakdownEntry                                                                |
| Smart city | metricGauge           | 1       | datasetId, heading, goalId                                                                                                                  | SmartCityGoal                                                                          |
| Smart city | metricTable           | 1       | datasetId, heading, category                                                                                                                | SmartCityMetric                                                                        |
| Smart city | metricTrendChart      | 1       | datasetId, heading, limit, series, category                                                                                                 | SmartCityObservation                                                                   |
| Maps       | map                   | 2       | savedMapId, primaryDatasetId, secondaryDatasetId, heading, limit, pointStyle, colorBy, sizeBy, interaction, height, showFilters, showLegend | GeoFeature; markers/circles/clusters/heatmap; details/link/none; compact/standard/tall |

There are **29** components: catalog groups layout 1, content 6, civic 13, smartcity 9. Maps and bookings are subgroups, not separate registry categories. No standalone form or media block is registered. Media is consumed by hero/news/events and booking owns its forms.

### Registration and render paths

- `component-definitions.ts` registers the complete list. `platform-registry.ts` creates the immutable, consistency-checked registry. `component-versions.lock.json` stores version/fingerprint evidence.
- `presentation/components/page-renderer/{component,civic,smartcity}-implementations.tsx` maps definitions to implementations.
- `page-node-renderer.tsx` restores props, renders children and supplies streaming skeletons/error boundaries.
- Builder uses `ListComponentCatalog` and `component-palette.tsx`, then the shared `renderPageNodes` composition API.
- Public `src/app/[locale]/(public)/s/[siteSlug]/[[...path]]/page.tsx` loads the published release through `src/app/_lib/published-page.ts` and renders the same trees. Release preview uses the same renderer.

## Data inventory

Fifteen canonical kinds exist: Event, NewsItem, Service, Contact, OpeningHoursEntry, ServiceDetail, CouncilBody, WasteCollectionEntry, Alert, Department, SmartCityMetric, SmartCityGoal, SmartCityObservation, SmartCityBreakdownEntry, GeoFeature.

`ListContent` scopes dataset reads to the rendered website. `DatasetContentSource` receives `getMappedDatasetRecords` through composition, validates mapped records against canonical contracts and currently drops malformed records. Unbound published components are empty; draft mode can show labelled samples.

REST is the only working connector. MOCK is a declared but unimplemented fixture seam. REST supports GET/POST JSON, records paths, offset/page/cursor/next-link pagination and spatial-filter templates. Existing field mapping supports bounded paths and fixed transforms; no executable mapping expressions.

REST security includes public-URL rules, DNS checks, manual redirects, 10-second exchanges, 5 MiB responses and a 30-second total read budget. Pagination caps at ten pages of 1,000 records. Residual DNS rebinding risk is documented because validation and connection do separate lookups.

The server cache uses Next cache lifetimes stale 60s / revalidate 120s / expire 900s. Keys include tenant, source, config, path and effective window. No per-source quota/TTL, circuit breaker, Retry-After handling, or retry/backoff was found. Do not describe those as implemented.

### Existing windowing

`ReadWindow` validates limit/offset/bbox. Trend charts use bounded count/offset windows, not named time-duration presets. `read-trend-window.ts` rate-limits browser requests; `metric-trend-chart-window.client.tsx` halves/doubles point counts, pages earlier/later and preserves previous data on errors. `pick-smart-city-series.ts` chooses a series and sorts a selected window chronologically.

Maps already use padded/debounced bounding boxes, bounded source filtering or bounded local filtering, last-good rendering and stale-response rejection. Reuse these facilities. Source date presets, aggregation/resolution and source budgets remain additions.

## Database and tenancy

Prisma 8 (`@prisma/orm-postgres` 8.0.0-rc.21) emits contracts into `src/lib/db`. Schema sources are `prisma/schema/*.prisma`; four migrations are present. Auth tables use a separate SQL migration/database. Do not use Prisma 7 migration commands from outdated convention examples.

- `Website.id = Website.tenantId` is a DB invariant. Child relationships reinforce website isolation where modeled. Data sources are scoped through their owning website.
- `Page` stores path/title/version. `PageConfig.content` is JSON `{ type: 'page', children: [...] }`, with nodes `{ id, type, props, children }`.
- Trees are bounded to 500 nodes, depth 12 and approximately 1,000,000 characters. Page paths are unique per website.
- Releases store immutable snapshots and SHA-256 hashes. Snapshot v2 has a v1 compatibility reader and contains website/theme/pages/maps/component pins. Public rendering never reads drafts.
- `DataSource.config` and `Dataset.mapping` are JSON; dataset canonical kind and relative endpoint path are stored independently.
- Saved maps have stored settings/version. Theme has colors, curated local fonts, radius and spacing density.
- No record-provenance model, media-license/credit fields, per-tenant locales or legal-entity model was located.

Seed entrypoint is `prisma/seed.ts`; production is refused. Modules should be `prisma/seed/<name>.seed.ts`, sorted by order/name. No modules existed at baseline. Missing runtime loader and wrong discovery directory are confirmed blockers. Commands: `db:generate`, `db:migrate:check`, `db:migrate`, `db:verify`, `db:seed`.

## Roles and permissions

Source: `src/modules/auth/domain/models/{role,permission}.ts` and `prisma/schema/access.prisma`.

| Role           | Scope and existing capabilities                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| platform_admin | platform tenant only; admin capabilities plus website creation/list-all and platform-admin management                 |
| admin          | website/theme, publishing/rollback, sources/datasets/pages, booking configuration, media, users and audit             |
| editor         | create/edit/restructure pages, booking management and media upload; no publishing or source/user/theme administration |
| contributor    | read website/release/dataset/pages and edit page content; no structural editing                                       |
| viewer         | read website/release/bookings                                                                                         |
| employee       | own booking profile and eligible work claims                                                                          |

Multiple tenant roles per actor are supported. `website.delete` exists in permission vocabulary but no role grants it. Invitations support pending/accepted/expired timestamps. Suspension and approval states are not implemented. Publisher/approver/citizen/department-staff roles are proposals, not existing facts.

Booking states: HELD, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW, EXPIRED. Waitlisted and pending are absent. Existing services already model buffers, capacity, slot interval, notice/horizon, cancellation/reschedule, required documents and assignment mode. Location hours/exceptions and German holidays exist. Visitor self-service uses booking reference plus email, not a cancellation token.

## Tokens and global CSS

Source: `src/app/globals.css`, `src/components/layout/`, website theme model and `presentation/theme/theme-css.ts`.

- Colors: semantic primary/secondary/accent with foreground/copy roles; canvas/surface/copy/muted/borders; success/warning/danger/info with subtle and border variants.
- Typography: local Source Serif 4, Inter, DM Sans and Geist via `next/font/local`. Existing Tailwind type utilities supply scale; no separate invented type-token set.
- Spacing: section rhythm and density multipliers (tight 0.6, default 1, airy 1.25). Theme spacing presets 2.5/4/6rem. Prose measure 40rem, narrow width 36rem.
- Radius: theme 0/2/6/12px; default 6px. Existing utility classes own border/shadow details; no dedicated shadow-token system was found.
- Focus: global visible two-pixel focus with offset; focus color derived from accent copy. Color helpers compute black/white foreground and readable copy to at least 4.5:1 on defined page surfaces; whole-component contrast remains unverified.
- Motion: 150ms and cubic-bezier token; reduced-motion suppression exists.
- Z-index: header 40, section bar 30. No dedicated z-index scale was found.
- Layout: Container (max-w-7xl), Section surface/density, Grid (1–4 columns), Rail (balanced/content-heavy). `page-rhythm.ts` already alternates density. Extend only where real composition requires it.

## Baseline and issue evidence

See `NOT-VERIFIED.md` for actual command outcomes, `ISSUES.md` for severity/classification, and `ASSUMPTIONS.md` for decisions. Baseline is **not green**. Static inspection does not verify visual quality, keyboard behavior, print, network privacy or accessibility conformance.
