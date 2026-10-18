# Backlog

Planned features that are **not built yet**, in suggested order. Finished work is deleted from this file in the same change that finishes it (the history is in git; how the finished parts work is in [`docs/architecture/`](./docs/architecture/)). Small fixes and findings live in [`TODO.md`](./TODO.md).

Each item names the goal, what it must cover, and when it is done. Every item follows the project rules ([`docs/rules/`](./docs/rules/README.md)): server-side validation, a use case behind every action, translated text, keyboard-usable UI.

| #   | Milestone                                               | Items                                                       |
| --- | ------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | [Pages and site structure](#1-pages-and-site-structure) | Manage pages, navigation editor, page SEO, delete a website |
| 2   | [Media](#2-media)                                       | Media library, media picker in the builder                  |
| 3   | [Civic forms](#3-civic-forms)                           | Form component, secure submission                           |
| 4   | [Search](#4-search)                                     | Site-wide search, search index abstraction                  |
| 5   | [Publishing](#5-publishing)                             | Scheduled publishing                                        |
| 6   | [Quality](#6-quality)                                   | Accessibility audit, performance audit, architecture audit  |

## What exists today (so items are not rebuilt)

- Page builder with a component catalog (civic, content, smart-city, layout), draft saving with optimistic concurrency, per-page revisions.
- Releases: preview, publish, roll back, component version migrations. Published sites read only the frozen snapshot of the live release.
- Data sources (REST/JSON and mock), discovery, field mapping to canonical kinds, and dataset-bound civic, KPI, chart and map components.
- Roles and permissions, invitations, platform administrators, audit trail.
- Bookings (services, resources, locations, public booking flow, e-mails with calendar file).
- A page has a **title and a path** (`about/team`), a `PageConfig` (its component tree) and nothing else.

---

## 1. Pages and site structure

### Manage pages (rename, move, delete)

**Labels:** `feature`, `builder`

Pages can be created but not changed afterwards: there is no rename, no path change, no delete.

- Rename a page and change its path; refuse a path another page already owns.
- Delete a page; refuse the home page; warn when other pages link to it.
- Every change is audited and goes live only with the next release.

**Done when**

- [ ] Rename, move and delete work behind `page.*` permissions and are refused for roles without them.
- [ ] The public site of a released version is unaffected until the next release.
- [ ] Draft and release history stay consistent (a deleted page can still be restored by rolling back).

### Navigation / site structure editor

**Labels:** `feature`, `navigation`, `builder`

A dedicated interface for the website's navigation and page hierarchy:

```text
Rathaus
  Bürgermeister
  Verwaltung
Bürgerservice
  Dienstleistungen
  Formulare
```

- Add, reorder and nest pages; remove from navigation without deleting the page.
- Navigation visibility per page; the URL follows the hierarchy.
- Prevent invalid structures (cycles, duplicate paths, orphans).

**Done when**

- [ ] The hierarchy is persisted and is part of the release snapshot.
- [ ] The public navigation reads the same source of truth.
- [ ] Invalid nesting is refused by the domain, not only by the UI.

### Page metadata and SEO

**Labels:** `feature`, `seo`

Per-page: title, description, social image, canonical URL where needed, indexing preference.

**Done when**

- [ ] Metadata is validated, persisted and part of the release snapshot.
- [ ] Published pages render it through the builders in `@lib/seo`.
- [ ] Editors with restricted roles see only the fields they may change.
- [ ] A default social (Open Graph) image exists for pages without their own.

### Delete a website

**Labels:** `feature`, `platform`

Platform administrators can create and edit websites but not remove one.

- Soft-delete first (the site stops being served, data is kept for a retention period), then purge.
- Confirm with the website's name; audit it; revoke the memberships' access.

**Done when**

- [ ] Only `website.*` permission holders (platform administrators) can delete.
- [ ] A deleted website's public address answers not found.
- [ ] Purging removes every tenant-scoped row and nothing else.

---

## 2. Media

### Media library

**Labels:** `feature`, `media`

A central library per website for images, PDFs and documents.

- Upload, browse, search, preview, delete; metadata; file type and size validation.
- Alt text for images, with decorative images explicitly marked.
- Storage behind a port (object storage in production, local disk in development); nothing is served from a user-controlled path.

**Done when**

- [ ] Uploads are validated on the server (type by content, not only extension; size limit) and rate limited.
- [ ] Permitted roles can use the library; others cannot read or change it.
- [ ] Alt text can be managed and is required unless the image is marked decorative.

### Media picker in the builder

**Labels:** `feature`, `builder`, `media`

Replace manual image URL entry in the properties inspector with select / upload.

**Done when**

- [ ] A component stores a stable media reference, not a URL.
- [ ] The public renderer resolves the reference from the released snapshot.
- [ ] Restricted editors only see the media operations their role allows.

---

## 3. Civic forms

### Form component

**Labels:** `feature`, `forms`, `civic`

A schema-driven form for municipal websites. Fields: text, textarea, email, number, select, checkbox, date. Required fields, accessible labels and errors, loading and success states. No workflow automation yet.

### Secure submission

**Labels:** `feature`, `forms`, `server`

- Server Action with Zod validation; structured field errors.
- Rate limiting and a spam-protection strategy (honeypot, then a challenge if needed).
- Where submissions go: stored for the website's staff and/or e-mailed to a configured address.

**Done when (both)**

- [ ] A form can be placed in the builder and configured without code.
- [ ] Client-side validation is a convenience only; the server validates everything.
- [ ] Submitting twice does not create duplicates; failures keep the visitor's input.

---

## 4. Search

### Site-wide search

**Labels:** `feature`, `search`

Search across pages, news, events, services, contacts, documents and locations: input, result list with type, title, excerpt and URL, empty and no-results states. Reads the published snapshot only.

### Search index abstraction

**Labels:** `architecture`, `search`

A `SearchService` with `SearchDocument` / `SearchResult` behind a port, so the backend can change. Start with PostgreSQL full-text search; do not introduce Elasticsearch/OpenSearch unless scale demands it.

**Done when (both)**

- [ ] Drafts and unpublished content are never searchable.
- [ ] The index updates when a release is published.
- [ ] Results are bounded and paginated.

---

## 5. Publishing

### Scheduled publishing

**Labels:** `feature`, `publishing`

Publish a prepared release at a future time.

- Scheduled time with explicit time zone; validation (not in the past, nothing newer superseding it).
- Server-side execution without a user session (a job runner or cron entry), idempotent and audited as `system`.
- Visible status: scheduled, published, failed; cancel or change before it runs.

**Done when**

- [ ] A scheduled release goes live once, at the time, even if the job runs twice.
- [ ] A failure leaves the live site unchanged and shows the reason.

---

## 6. Quality

### Accessibility audit (WCAG)

**Labels:** `quality`, `accessibility`

Audit the builder and published sites: keyboard navigation, focus, semantics, heading hierarchy, landmarks, forms and errors, contrast, alt text, screen-reader behaviour, responsive layouts.

**Done when:** critical issues are fixed, the builder is keyboard-usable, public components have accessible defaults.

### Performance audit

**Labels:** `quality`, `performance`

Audit published sites for unnecessary client JavaScript and rendering cost: Server Components first, caching, image optimization, bundle size, hydration, data fetching. Prefer a Server Component unless interactivity truly needs the client.

**Done when:** measured findings are fixed or recorded, with before/after numbers.

### Architecture audit

**Labels:** `architecture`, `maintenance`

After the next large features, review: duplicated logic or validation, inconsistent `Result` handling, oversized components, unnecessary client components, repository and service boundaries, caching, the component registry and `PageConfig` types. Do not rewrite working systems.

**Done when:** duplicates are consolidated where justified, tests pass, and the architecture stays understandable.

---

## Working rule

Prefer focused items over another large phase: one feature, then implementation, tests, review, and an architecture audit when needed. That keeps the codebase understandable while the platform grows.
