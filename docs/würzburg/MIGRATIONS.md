# Compatibility and migration guide

No physical database contract change was introduced. Existing JSON-backed sources, datasets, page revisions and website releases are reused. The Prisma migration graph check and strict current-database verification passed; fresh-database migration and rollback were not executed.

Booking integration later established that the current contract does **not** declare the exclusion constraint described by older comments. Resource-locked occupancy checks now include employees, and regression concurrency tests pass. A reviewed database-level constraint migration remains open; no ad-hoc constraint or migration-history rewrite was applied. Tenant cleanup removes bookings before resource/service cascades because the existing FKs are immediate. Corrected schema comments do not change the storage contract.

## Versioned component changes

| Component                                                                            | Before | After | Stored-data behavior                                                                                                                      |
| ------------------------------------------------------------------------------------ | ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `kpiGrid`, `metricChart`, `metricComparisonChart`, `metricTable`, `metricTrendChart` | 1      | 2     | Bounded arbitrary source/config categories replace a fixed domain enum. Empty string and historical `all` still mean no filter.           |
| `dashboardGrid`                                                                      | 3      | 4     | Same category compatibility; enabled panels load independently and preserve all successful source metadata.                               |
| `quickLinks`                                                                         | 1      | 2     | Optional `placement` defaults to `content`. Only explicit root `header` and `footer` placements become published page landmarks.          |
| `section`                                                                            | 1      | 2     | Optional `layout` defaults to `stack`; optional `density` defaults to `default`. New split/aside composition uses existing layout tokens. |

`legacy-component-props.ts` retains frozen preceding-version defaults. `GetComponentDefaultProps` reads those defaults for historical pins. The version lock is regenerated with `npm.cmd run components:lock`; architecture tests check it. Existing release snapshots remain immutable.

The reviewable category codemod accepts one exported builder tree and writes a **new** file:

```powershell
npx.cmd tsx scripts/wuerzburg/migrate-props.ts exported-page.json migrated-page.json
```

It removes only the old empty/`all` category sentinel on the six affected components. It preserves custom category strings, siblings and unknown metadata, bounds depth/node count/bytes, and refuses to overwrite an output file. Unit tests cover category migration and historical defaults; executing the CLI and importing the result into an existing tenant remain Not Verified. Review the output and create a new page revision through normal builder workflows. Never edit published release JSON in place.

Quick-links and section additions need no payload rewrite because their new fields are optional with historical defaults. A rollback should restore the previous published release pointer through normal release controls; rollback execution is Not Verified. Reverting code without retaining readers for newly stored props is not a safe rollback plan.

## Source JSON

The existing `MOCK` kind now accepts a versioned `{schemaVersion:1,records,provenance,windowPolicy?}` snapshot configuration. Legacy `{}` remains accepted and reports unavailable rather than inventing records. Validators reject unsupported versions, oversized/deep JSON and malformed provenance. Snapshot sources perform no remote requests or filesystem reads at runtime.

The optional version-one window policy bounds records and offset and declares ordering. Existing record/bounding-box windows are reused. Named duration presets, aggregation/downsampling, live quota coordination, circuit breakers and overlapping-window prefetch are not implemented by this policy.

Canonical target names were aligned with the actual content contracts. Historical opening-hours, alert and waste target names remain accepted. This is not a full alias migration: an old mapping with incompatible field semantics may still need an explicit field-map revision before it renders current content. Review field maps before publishing.

Source-backed content carries license, attribution, capture time and rejected-record counts through the existing data access path. Here `ContentOrigin.kind='live'` means a bound source; the nested provenance distinguishes live, snapshot and synthetic records. The UI uses that nested provenance, not the transport label, to describe freshness.

## Seed ownership and recovery

The fixed website is `3b0f6f2e-8a51-4c9d-9e27-5d1a7c4b2f80` (until 2026-11-09 `reference-city-wuerzburg`, which tenancy could not read as a website; see WUE-050). Application writes share an advisory lock and transaction. Auth has a separate transaction. Seed source/mapping JSON updates only when content differs; pages append revisions with compare-and-swap; releases append only when their snapshot hash changes. Existing booking lifecycle transitions and existing passwords are preserved.

Administrative seed provenance lives in a bounded JSON source named `reference-city-wuerzburg-provenance`, because current tables have no provenance column. Content records also carry `_provenance`. This sidecar is not a generic audit log or a physical provenance constraint on all future user records.

Repeated-seed proof is [seed-idempotency.json](verification/seed-idempotency.json). Scoped reset, fresh database installation, migration up/down and operational rollback remain Not Verified. No Git commits or migration history edits were made.

## Citizen-site and source-category follow-up

- statusBoard starts at version 1 and reuses GeoFeature's name/status/observedAt fields. Parking has a separate dataset ID from the previous service-shaped draft; historical releases keep their previous dataset contract.
- WasteCollectionEntry and wasteCalendar advance to version 2. New source-defined labels are bounded nonempty strings. Legacy stored keys still render translated labels, and the previous calendar defaults are frozen. This is an identity migration for stored props. If older ingestion already replaced a source category with a different canonical key, re-ingest the original source; the lost meaning cannot be guessed.
- Map component props remain version 2. External website/dataset IDs now follow their owning modules' opaque 128-character IDs; map-owned IDs remain UUIDs. Mapped records can expose an optional maximum read size. Existing consumers without that hint retain the old behavior.
- New seed page IDs derive from a stable path hash. Existing path IDs and revisions remain intact. Old public pages are omitted from the new immutable release, not deleted from history. Seed metadata updates only when changed.
- Ingestion updates existing source configs in one tenant-scoped transaction. It does not run the account/booking/page seed or alter releases. The operator must install a deployment schedule separately.
- SmartCityObservation accepts optional bounded `resolution`. Existing observations without it remain instants. Source daily buckets mapped as `P1D` use the shared calendar-date formatter, preserving their day across visitor time zones. No stored component prop changes are involved.
- Freshness metadata now sets `validUntil` from each configured refresh budget. Expiry retains values and displays an overdue-refresh warning; it never changes the underlying observation timestamp.
- Complete chart series start their visitor window at the available record count, bounded by the source maximum. This corrects inert zoom without changing stored props. Tables paginate the already bounded window by 20 rows.
- Identical source-place duplicates are removed during reviewed ingestion. Conflicting identities stop validation. The original HTTP fixture and hash remain available; no source identity is invented.
