# Onboard another city

The current reusable path covers bounded JSON snapshots and the repository's existing guarded REST, Postgres, Supabase and Google Sheets connectors. A complete CKAN/DCAT/OParl/GTFS/GBFS/OGC/RSS adapter family is not implemented. Do not claim a source type works until its adapter and contract tests exist.

1. Inventory the tenant's actual services, existing roles, component contracts and source terms. Fetch robots and license information before record requests. A catalog link is only a discovery lead.
2. Record each attempted source in the source register: URL, date, status, type, auth, terms, limits, grouping, geography, time range and verdict. Keep failed or license-unknown sources Not Verified. Avoid copying personal information into fixtures.
3. Capture bounded, dated responses and metadata in a new fixture directory. Add boundary contract tests for required, optional, null and empty values. Preserve source categories and units instead of assigning a universal category enum.
4. For an offline snapshot, configure `MOCK` with schema version 1, bounded `records`, provenance and optional window policy. Use a real reviewed license for snapshots; mark invented civic examples synthetic. Set `sourceUrl`, `fetchedAt`, attribution and license links accurately.
5. Create a Dataset with an existing canonical content kind and explicit field mappings. Raw source IDs are handled by the mapper: do not map an `id` target. Check target names against the canonical target-field definitions. Unsupported entity shapes require an evidenced contract change, not a fabricated field.
6. Choose record and offset budgets and stable ordering. Time-series observations should be ordered by canonical `observedAt` before paging. Different units must remain separately labelled. Declaring a larger window does not add source history or create aggregation support.
7. Create the Website, theme and stored builder page trees through existing ownership boundaries. Use `quickLinks` placement for page chrome and section composition for rhythm. Publish an immutable release with component/content dependency pins. Keep review-only labs out of public releases.
8. Provision only implemented roles and booking states. Preserve tenant isolation and enforce permissions server-side. Never use real citizen details in demo accounts, bookings or contact blocks.
9. Test local seed idempotency, source failures, keyboard journeys, page landmarks, mobile/reflow, brand contrast and third-party requests. Maintain an honest verification ledger and legal review boundary before production.

The Würzburg example changes configuration, mappings, fixture files, theme, page content and fictional account IDs. Components and the public route remain shared. Its development seeder currently contains Würzburg-specific fixture composition; a second-tenant portability proof has **not** been executed. Do not copy the fixed Würzburg IDs or its seed reset into another city's environment.

First-party SVG maps render actual point, line and polygon geometry without client tile requests. They provide zoom, pointer selection and an equivalent keyboard list. They are geographic overviews, not street-routing or heatmap services. External tile delivery still requires an approved, documented basis or consent implementation; a token flag alone is not a consent manager.

## Operate the source refresh worker

The Würzburg worker is an implemented ingestion path for the reviewed captured sources, not a generic adapter for every city or protocol. Configure another city's own source IDs, review and mappings before reusing the pattern.

1. Install Node 24 and curl on the worker host. Deploy the same checkout/fixtures and supply database credentials through environment configuration. Never put credentials in the source policy or logs.
2. Run `npm run data:wuerzburg:refresh` once and inspect `docs/würzburg/verification/ingest-last-run.json`. It validates before updating existing snapshot configurations and uses the same advisory lock as the development seed. It does not run the seed or publish pages.
3. Configure the host's service manager to run `npm run data:wuerzburg:watch` with the repository as working directory, restart on process failure, and collect stdout/stderr. Only one worker may use this checkout. Check every five minutes; per-source policies enforce longer intervals.
4. Alert on `applied: false`, nonempty `failures`, unexpectedly old `finishedAt`, worker exit, or overdue capture timestamps. The UI displays overdue refreshes while retaining dated values. Inspect measurement timestamps separately from capture time.
5. Stop with SIGTERM/SIGINT. The current bounded refresh completes before shutdown. An exclusive `.wuerzburg-ingest.lock` stores the owning PID and start time. After a forced crash, verify that no refresh process remains before removing that exact stale lock. Never remove another worker's active lock.
6. For a failure before DB application, previous captures are restored. An upstream HTTP/format failure retains that source's last successful capture and records the failed attempt. A register-generation failure after application is reported for repair; it does not roll back already committed data. Back up the database and fixtures through the deployment's normal process.

A deployed service manager, multi-host coordination, crash recovery and complete timeout/429/schema-drift drills are **Not Verified**. Local successful and within-budget runs do not establish production operations. Date-only series must declare their resolution and use calendar-date formatting; do not fabricate local observation times.
