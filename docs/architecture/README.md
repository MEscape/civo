# Architecture

How each subsystem works: components, layer responsibilities, workflows, rules, failure paths and extension points. The canonical engineering rules live in [`docs/rules/`](../rules/README.md); these documents explain how the implementation realises them.

Each document follows the same ten sections: Overview, Architecture and Layer Responsibilities, Architecture Diagram, Main Workflow, State and Data Flow, Business Rules and Invariants, Errors and Edge Cases, Security and Access Control, Testing and Verification, Extension Points and Constraints. Where a flow is only prescribed by the rules and has no caller yet, the document says so.

## Shared library (`src/lib`)

| Document                                     | Covers                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| [error-handling.md](./error-handling.md)     | `AppError`, `AppResult`, field errors, HTTP mapping, server-action error contract |
| [logging.md](./logging.md)                   | Logger, redaction, audit log, query and rate-limit logging                        |
| [configuration.md](./configuration.md)       | Environment schema composition, server/public split, `parseEnv`, app identity     |
| [persistence.md](./persistence.md)           | Prisma client, transactions, rollback, transient retry, failure mapping, seeding  |
| [rate-limiting.md](./rate-limiting.md)       | Limiter, policies, subjects, client address, Upstash store                        |
| [request-pipeline.md](./request-pipeline.md) | `proxy.ts`, security headers, tenant hint, health endpoint                        |
| [mail.md](./mail.md)                         | Mail transports (SMTP, Resend), email layout and brand                            |
| [storage.md](./storage.md)                   | Object store abstraction, S3 implementation, SigV4, limits                        |
| [i18n-and-seo.md](./i18n-and-seo.md)         | Locales, message catalogs, providers, localized metadata                          |
| [pagination.md](./pagination.md)             | Page requests, sorting, clamped page loading                                      |

## Business modules

- [Authentication and access management](./auth-access.md): invitations, sessions, website memberships, platform authority and responsive administration.
- [Audit trail](./audit.md): event recording, authorized website scopes, auth integration, activity digests and retention.
- [Releases](./release.md): publishing, restore, preview, component updates, neighbour adapters and release screens.
- [Builder](./builder.md): draft pages, the page editor, edit scope, revisions with compare-and-swap, and draft rendering.
- [Component platform](./component-platform.md): the component and content catalogs, versioning, the page renderer, and published versus draft content.
- [Booking](./booking.md): locations, services, resources and team, the visitor's journey and "my booking", website-scoped authorization, the setup guide and how release sees it.
- [Data sources](./data-sources.md): target authorization, REST connections, dataset wizards, mapping, bounded administration, and guarded release deletion.
- [Media](./media.md): the two-step verified upload, the library and picker, safe deletion, and public addresses.
- [Maps](./map.md): website-scoped saved maps, protected configuration and previews, viewport windows, shared canvas lifecycle, and source-reference protection.
- [Website management](./website.md): auth-backed target access, website/theme writes, loaders, responsive administration and shared UI integration.

## Shared UI

Shared components (`src/components`) are documented once, in [`src/components/README.md`](../../src/components/README.md): which composite to use, and what `DataPanel`, `LinkTabs`, the skeletons and the others own. Module documents link there instead of repeating it.

## Known gaps found while documenting

These are repository inconsistencies, not documentation errors. They are recorded here, not fixed.

- Map forwards viewport bounds, but data sources currently resolves record windows by limit and offset. Filtering spatially before pagination remains an integration gap; see [data sources](./data-sources.md).
- Prisma contract artifacts and the saved-map migration graph are present. Applying migrations to a database remains a separate verification step; generated files alone do not establish database readiness.
- Link to nonexistent document: `route-protection.md` (from `src/lib/README.md`, `tenant-hint.ts`).
- Referenced but missing: `scripts/lib/server-runtime.ts`.
- `docs/conventions/adding-a-translation.md` names `src/i18n/<locale>.json`; the catalogs are in `src/i18n/messages/<locale>.json`.
