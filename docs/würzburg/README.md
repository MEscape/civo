# Würzburg reference city

The current site is a citizen-facing civic composition built from real public records and verified service links. It uses stored builder trees and immutable published releases. It is not an official municipal deployment: operator/legal approval and the remaining verification below are still required before public launch.

## Run locally

Use Node 24 and the repository's npm lockfile. Configure application/auth Postgres, Redis and object storage using [`.env.example`](../../.env.example). Keep credentials in ignored environment files.

```powershell
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run db:verify
npm.cmd run seed:wuerzburg:validate
npm.cmd run seed:wuerzburg
npm.cmd run dev
```

Open [the city site](http://localhost:3000/de/s/wuerzburg). The current manifest has 12 public pages and one internal Component Lab draft. Five topic entry points replace the former catalog-heavy navigation. Maps are integrated into their topics. Components appear only where a citizen task justifies them; see [coverage](03-component-coverage.md). Previous seed pages remain in revision history/storage, outside the current public release.

The seed reads only local fixtures. Preparing the manifest is optional: `npm.cmd run seed:wuerzburg:prepare`. It never refreshes remote responses implicitly. Production seeding is refused. A slug owned by another website or a reference page path owned by a non-seed record is refused.

Development credentials are described in [DEMO-ACCOUNTS.md](DEMO-ACCOUNTS.md). The seed generates an ignored password file when no password environment variable is supplied. No password is stored in this documentation or the manifest.

## What the data means

All 18 configured datasets contain real source snapshots. Public bindings include all 13 district geometries, all 177 bicycle parking locations, 2,600 waste-calendar records, cycle counters, 87 distinct toilet locations, parking statuses, 12 climate-tree locations, PEGELONLINE measurements and the Wikidata Rathaus building point. The toilet fixture contains nine exact duplicate rows, retained as evidence and deduplicated during ingestion. The bounded tree sample and historical Ludwigkai weather are retained for internal contract review; the public site links to the full tree cadastre. Parking has statuses, not free-space counts. Dubious population values are withheld. Full metadata for 185 city catalog entries and 261 recorded HTTP responses is documented in the [source register](01-data-source-register.md).

First-party SVG maps show actual geographic records without external tiles, fonts or telemetry. Zoom, selection and an accessible list alternative work without a Mapbox token. The site uses self-hosted fonts and no external images or embedded services. Turning on external tile services still requires a documented basis or consent design.

Service search leads to the official city appointment path. The public site does not accept a local test booking as a municipal appointment. Generated bookings and fictional staff remain internal fixtures.

An operator ingestion command is `npm.cmd run data:wuerzburg:refresh`. It checks per-source budgets in `data/sources/wuerzburg.ingest.json`, performs bounded server-side requests, validates the resulting manifest and updates only existing snapshot sources. It never creates users, bookings or pages. Failed requests retain the previous successful capture. Scheduling on the deployment host remains an operator step; adding a command does not establish automatic refresh.

For a separate long-running worker, use `npm.cmd run data:wuerzburg:watch` on a host with Node 24, curl, the same source fixtures and the application's database environment. It checks due sources every five minutes; individual source budgets remain authoritative. Run one worker against this checkout. Monitor `verification/ingest-last-run.json` and process failures. A successful capture is not a guarantee that an upstream observation is current: parking and gauge values retain their own measurement timestamps. Overdue refreshes keep the previous data and display an explicit freshness warning. See [operations](ONBOARD-A-CITY.md#operate-the-source-refresh-worker).

## Maintenance

```powershell
npx.cmd tsx --import ./scripts/lib/server-runtime.ts scripts/wuerzburg/verify-seed.ts
node scripts/wuerzburg/coverage.mjs
```

The idempotency check runs the reference seed twice and compares full-row digests, including timestamps and versions, across 15 application tables. It deliberately excludes authentication credential hashes and does not prove a fresh-database migration.

The requested scoped reset command is `npm.cmd run seed:wuerzburg:reset -- --confirm-wuerzburg`. It deletes the fixed reference website and its exact fictional identities, not the database. It has **not been executed or verified**. Do not use it after adding work to this tenant without an export. Reset/reseed is not an approved migration repair strategy.

See [progress](PROGRESS.md), [verification limits](NOT-VERIFIED.md), [migration notes](MIGRATIONS.md), [onboarding](ONBOARD-A-CITY.md), and [Design Review](DESIGN-REVIEW.md). No commits were made, as requested.
