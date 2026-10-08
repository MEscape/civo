# GitHub Issue Backlog — Civic Website Platform

## Milestone: Data Integration

### Issue: Add Data Sources management to Settings

**Labels:** `feature`, `data-integration`, `admin`

### Description

Add a dedicated **Data Sources** section to the existing Settings area.

The purpose is to allow internal administrators to connect municipal, civic, and smart-city data sources that can later be consumed by website components.

### Requirements

- Add `Settings → Data Sources`.
- Display configured data sources.
- Add a new data source.
- Edit an existing data source.
- Enable/disable a data source.
- Delete a data source.
- Display connection status.
- Display last successful connection/fetch.
- Display mapping status.
- Provide a `Test Connection` action.
- Keep credentials server-side.

### Initial supported source

Start with:

- REST / JSON API

The architecture should allow additional adapters later.

### Acceptance Criteria

- [ ] Data Sources appears in Settings.
- [ ] Administrator can create a REST/JSON source.
- [ ] Administrator can edit/delete/disable sources.
- [ ] Credentials are never exposed to the client.
- [ ] Connection status is visible.
- [ ] Existing settings functionality remains unaffected.

---

## Issue: Implement external Data Source adapter architecture

**Labels:** `feature`, `architecture`, `data-integration`

### Description

Create the adapter layer used to communicate with external civic and smart-city data providers.

External APIs must not be coupled directly to website components.

### Target architecture

```text
Data Source
    ↓
Adapter
    ↓
External Response
    ↓
Mapping
    ↓
Canonical Data
```

### Requirements

Introduce an abstraction similar to:

```ts
interface DataSourceAdapter {
  testConnection(...): Promise<Result<..., AppError>>;
  discover(...): Promise<Result<..., AppError>>;
  fetch(...): Promise<Result<..., AppError>>;
}
```

Implement:

```text
RestJsonAdapter
```

first.

### Acceptance Criteria

- [ ] Adapter interface exists.
- [ ] REST/JSON implementation exists.
- [ ] Adapter uses `Result<T, AppError>`.
- [ ] Expected network/API failures do not throw.
- [ ] Components do not directly call external APIs.
- [ ] Adapter implementation is independently testable.

---

## Issue: Add Data Source connection testing

**Labels:** `feature`, `data-integration`

### Description

Allow administrators to test a configured external data source before using it.

### Requirements

The server action/service should:

1. Validate configuration.
2. Resolve the correct adapter.
3. Perform the request server-side.
4. Apply timeout handling.
5. Validate the response.
6. Return a structured result.

### Error states

Support meaningful errors such as:

```text
DATA_SOURCE_INVALID
DATA_SOURCE_UNREACHABLE
DATA_SOURCE_TIMEOUT
DATA_SOURCE_UNAUTHORIZED
DATA_SOURCE_INVALID_RESPONSE
```

### Acceptance Criteria

- [ ] Test Connection button exists.
- [ ] Request executes server-side.
- [ ] Success is clearly displayed.
- [ ] Failure explains the category of problem.
- [ ] Secrets are never returned.
- [ ] No expected operational error crashes the application.

---

## Issue: Implement civic data discovery

**Labels:** `feature`, `data-integration`

### Description

After connecting a data source, administrators should be able to inspect the available data.

### Example

```text
Municipal API

/events
/news
/services
/locations
```

For JSON responses, display the discovered structure and representative fields.

### Requirements

- Fetch a safe sample response.
- Inspect object/array structures.
- Identify available fields.
- Display nested fields.
- Handle malformed responses.
- Limit response size.

### Acceptance Criteria

- [ ] Administrator can inspect a connected source.
- [ ] JSON structures are displayed clearly.
- [ ] Nested fields are discoverable.
- [ ] Invalid responses are handled safely.

---

## Issue: Implement canonical civic data mapping

**Labels:** `feature`, `data-integration`, `architecture`

### Description

Allow external data to be mapped into the platform's canonical data models.

Example:

```text
External API             Canonical Event

event_name       →       title
description      →       description
start_time       →       startDate
end_time         →       endDate
venue            →       location.name
website          →       url
```

### Requirements

Support:

- nested field mapping,
- required fields,
- optional fields,
- default values,
- basic transformations.

Initial transformations:

- string
- number
- boolean
- date
- datetime
- URL
- fallback value
- nested property
- basic array selection

Do not introduce executable JavaScript into mappings.

### Acceptance Criteria

- [ ] External fields can be mapped.
- [ ] Nested fields work.
- [ ] Required fields are validated.
- [ ] Mapping configuration is persisted.
- [ ] Mapping produces canonical data.
- [ ] Invalid mappings produce structured errors.

---

## Issue: Connect external datasets to MunicipalityDataProvider

**Labels:** `feature`, `data-integration`

### Description

Integrate configured external datasets into the existing `MunicipalityDataProvider`.

The provider becomes the stable interface between external data and the website renderer.

### Example

```text
REST API
  ↓
Adapter
  ↓
Mapping
  ↓
Canonical Event[]
  ↓
MunicipalityDataProvider
  ↓
EventsGrid
```

### Acceptance Criteria

- [ ] Existing provider abstraction is reused.
- [ ] External datasets can provide canonical data.
- [ ] Components do not know the external API format.
- [ ] Provider failures use `Result<T, AppError>`.
- [ ] Existing mock/local providers continue to work.

---

# Milestone: Smart City Components

## Issue: Add canonical geospatial data model

**Labels:** `feature`, `smart-city`, `maps`

### Description

Introduce or strengthen the canonical geospatial model required by smart-city features.

### Requirements

Support concepts such as:

```ts
Location {
  latitude
  longitude
  address?
  name?
}
```

Consider support for:

- coordinates,
- addresses,
- GeoJSON,
- feature properties,
- categories.

The model should remain provider-agnostic.

### Acceptance Criteria

- [ ] Canonical location model exists.
- [ ] Coordinates are validated.
- [ ] GeoJSON can be represented safely where needed.
- [ ] External provider-specific location formats remain hidden behind adapters.

---

## Issue: Build reusable Map component

**Labels:** `feature`, `smart-city`, `maps`, `builder`

### Description

Create a reusable map component for civic and smart-city websites.

### Initial capabilities

- display map,
- display markers,
- marker popup,
- basic zoom,
- basic center configuration,
- responsive behavior,
- accessible fallback.

Later features can build on this component.

### Acceptance Criteria

- [ ] Map works as a PageConfig component.
- [ ] Map receives canonical data.
- [ ] Marker data is provider-agnostic.
- [ ] Map can be configured in the builder.
- [ ] Public renderer remains independent from editor implementation.

---

## Issue: Add GeoJSON data support to Map component

**Labels:** `feature`, `smart-city`, `maps`

### Description

Allow the Map component to consume canonical GeoJSON/geospatial datasets.

### Example use cases

- municipal boundaries,
- construction zones,
- cycling routes,
- parking areas,
- flood zones,
- public facilities.

### Acceptance Criteria

- [ ] GeoJSON datasets can be configured.
- [ ] Features render correctly.
- [ ] Feature properties can be shown safely.
- [ ] Invalid GeoJSON is handled gracefully.

---

## Issue: Add smart-city KPI component

**Labels:** `feature`, `smart-city`, `data-integration`

### Description

Create a reusable KPI/data card for live municipal data.

Example:

```text
Available parking

142

spaces
```

Other examples:

```text
Air quality
Good

EV chargers
18 available

Temperature
17.4 °C
```

### Requirements

Support:

- dataset selection,
- value selection,
- label,
- unit,
- formatting,
- loading,
- empty,
- error,
- stale-data state.

---

## Issue: Add data-aware civic components

**Labels:** `feature`, `data-integration`

### Description

Connect existing civic components to configured canonical datasets.

Initial components:

- Events Grid
- News Grid
- Services List
- Contact List
- Location List

### Requirements

Components should select a configured dataset rather than an external URL.

Example:

```text
Events Grid

Dataset
[ Municipal Events ]

Limit
[ 6 ]
```

### Acceptance Criteria

- [ ] Components consume canonical data.
- [ ] Dataset selection is persisted in PageConfig.
- [ ] Loading/empty/error states exist.
- [ ] Components remain independent from external APIs.

---

# Milestone: Media

## Issue: Build municipal Media Library

**Labels:** `feature`, `media`, `cms`

### Description

Create a centralized media library for municipality websites.

### Supported assets

Initially:

- images,
- PDFs,
- documents.

### Requirements

- Upload.
- Browse.
- Search.
- Preview.
- Delete.
- Metadata.
- Alt text.
- File type validation.
- File size validation.

### Accessibility

Images should support meaningful alt text.

Decorative images should be explicitly distinguishable.

### Acceptance Criteria

- [ ] Municipality users can access permitted media.
- [ ] Upload validation exists.
- [ ] Media can be selected from the builder.
- [ ] Image URLs are not manually required for normal workflows.
- [ ] Alt text can be managed.

---

## Issue: Add image/media picker to builder

**Labels:** `feature`, `builder`, `media`

### Description

Integrate the Media Library into the existing properties inspector.

Replace manual image URL entry where appropriate.

### Acceptance Criteria

- [ ] User can select an existing asset.
- [ ] User can upload/select media.
- [ ] Selected media is stored as a stable reference.
- [ ] Public renderer resolves the asset correctly.
- [ ] Municipality editor only sees permitted media operations.

---

# Milestone: Site Structure

## Issue: Build navigation/site structure editor

**Labels:** `feature`, `navigation`, `builder`

### Description

Add a dedicated interface for managing the website's navigation and page hierarchy.

### Example

```text
Home

Rathaus
  Bürgermeister
  Verwaltung
  Gemeinderat

Bürgerservice
  Dienstleistungen
  Formulare
  Ansprechpartner

Leben & Wohnen
  Veranstaltungen
  Einrichtungen

Smart City
  Mobilität
  Umwelt
  Open Data
```

### Requirements

- Add page.
- Rename page.
- Reorder pages.
- Nest pages.
- Remove page.
- Configure navigation visibility.
- Configure URL/path.
- Prevent invalid navigation structures.

### Acceptance Criteria

- [ ] Navigation hierarchy is persisted.
- [ ] Public navigation uses the same source of truth.
- [ ] Builder/editor can navigate the hierarchy.
- [ ] Invalid nesting is prevented.

---

## Issue: Add page metadata and SEO settings

**Labels:** `feature`, `seo`, `navigation`

### Description

Allow administrators to configure page-level metadata.

### Fields

- title,
- description,
- slug,
- social image,
- canonical URL where needed,
- indexing preference.

### Acceptance Criteria

- [ ] Metadata is persisted.
- [ ] Public pages render metadata correctly.
- [ ] Validation exists.
- [ ] Municipality editor only sees permitted fields.

---

# Milestone: Civic Forms

## Issue: Build reusable civic Form component

**Labels:** `feature`, `forms`, `civic`

### Description

Create a structured form component that can be used for municipal websites.

### Initial field types

- text,
- textarea,
- email,
- number,
- select,
- checkbox,
- date.

### Requirements

- schema-driven validation,
- required fields,
- accessible labels,
- error messages,
- success state,
- loading state.

Do not implement complex workflow automation yet.

---

## Issue: Add server-side civic form submission

**Labels:** `feature`, `forms`, `server`

### Description

Create a secure server-side submission flow for the Form component.

### Requirements

- Server Action.
- Zod validation.
- rate limiting strategy,
- spam protection strategy,
- structured errors,
- success response.

Never trust client-side validation alone.

---

# Milestone: Search

## Issue: Build site-wide civic search

**Labels:** `feature`, `search`

### Description

Create site-wide search across structured municipal content.

### Search targets

Initially:

- pages,
- news,
- events,
- services,
- contacts,
- documents,
- locations.

### Requirements

- search input,
- result list,
- result type,
- title,
- description/excerpt,
- URL,
- empty state,
- no-results state.

The architecture should allow a more advanced search backend later.

---

## Issue: Add search indexing for structured content

**Labels:** `feature`, `search`, `architecture`

### Description

Create a search index abstraction for the platform's structured content.

The index should not depend directly on a specific search provider.

Conceptually:

```ts
SearchService;
SearchDocument;
SearchResult;
```

Start simple.

Do not introduce Elasticsearch/OpenSearch unless the actual scale requires it.

---

# Milestone: Accessibility & Quality

## Issue: Perform full WCAG accessibility audit

**Labels:** `quality`, `accessibility`

### Description

Audit the builder and generated public websites for accessibility.

### Areas

- keyboard navigation,
- focus management,
- semantic HTML,
- heading hierarchy,
- landmarks,
- forms,
- error messages,
- contrast,
- image alt text,
- screen reader behavior,
- responsive layouts.

### Acceptance Criteria

- [ ] Critical accessibility issues are fixed.
- [ ] Builder is keyboard usable.
- [ ] Public components have accessible defaults.
- [ ] Forms have accessible errors.
- [ ] Images have appropriate alt handling.

---

## Issue: Perform public website performance audit

**Labels:** `performance`, `quality`

### Description

Audit generated websites for unnecessary client JavaScript and rendering overhead.

### Focus

- Server Components,
- caching,
- image optimization,
- bundle size,
- unnecessary hydration,
- data fetching,
- rendering performance.

### Principle

Prefer:

```text
Server Component
```

over:

```text
Client Component
```

unless interactivity genuinely requires client-side behavior.

---

# Milestone: Architecture

## Issue: Perform post-feature architecture audit

**Labels:** `architecture`, `refactor`, `maintenance`

### Description

After several major features have been implemented, perform a focused architecture review.

Do not rewrite working systems unnecessarily.

### Inspect

- duplicated logic,
- inconsistent Result handling,
- oversized components,
- unnecessary client components,
- duplicated validation,
- repository/service boundaries,
- Prisma usage,
- Redux usage,
- caching,
- error handling,
- component registry,
- PageConfig types,
- data-provider abstractions.

### Acceptance Criteria

- [ ] Duplicate abstractions are consolidated where justified.
- [ ] Server/client boundaries are reviewed.
- [ ] Existing architecture remains understandable.
- [ ] No unnecessary rewrite is introduced.
- [ ] Tests continue to pass.

---

# Milestone: Publishing

## Issue: Implement draft/published state

**Labels:** `feature`, `publishing`, `cms`

### Description

Introduce a clear distinction between editable draft content and the currently published website.

### Flow

```text
Draft
 ↓
Preview
 ↓
Publish
 ↓
Published
```

### Requirements

- draft state,
- published state,
- publish action,
- validation before publishing,
- public renderer reads published state.

---

## Issue: Add page/site revision history

**Labels:** `feature`, `publishing`, `cms`

### Description

Allow administrators to see previous published/draft versions and restore a previous version.

### Initial scope

- create revision,
- list revisions,
- view revision,
- restore revision.

Do not implement collaborative editing.

---

## Issue: Add scheduled publishing

**Labels:** `feature`, `publishing`

### Description

Allow a municipality to schedule a prepared website/content change for publication at a future time.

### Requirements

- scheduled publish time,
- timezone handling,
- validation,
- server-side execution,
- status visibility.

---

# Milestone: Future Infrastructure

## Issue: Introduce authentication boundary

**Labels:** `security`, `infrastructure`, `future`

### Description

Introduce real authentication while preserving the existing authorization boundary.

### Important

Do not couple authentication deeply into:

- PageRenderer,
- components,
- PageConfig,
- data adapters.

Authentication should sit at the application boundary.

---

## Issue: Implement role-based authorization

**Labels:** `security`, `authorization`, `future`

### Potential roles

```text
Platform Admin
Municipality Admin
Municipality Editor
Content Editor
```

The exact roles should be determined by actual product requirements.

Authorization should control:

- data sources,
- mappings,
- media,
- pages,
- publishing,
- settings.

---

# Product Development Rule

After the core data integration work, avoid creating another massive implementation phase unless a new subsystem is genuinely large.

Prefer focused issues:

```text
One feature
    ↓
Implementation
    ↓
Tests
    ↓
Code review
    ↓
Architecture audit when needed
```

This keeps the codebase understandable while allowing the platform to grow.
