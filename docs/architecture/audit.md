# Audit trail

Every module already records its business and security events through its own audit port (`createAuditLog`, one log line per event). The audit module keeps the ones that matter for a website in the database, so administrators can see what happened on their website, by whom, and when.

## Shape

```text
booking ─┐
builder ─┤  composition.ts: withAuditTrail(loggerXAuditLog, { source, levels, policy })
release ─┼──────────────────────────────────────────────────────► audit (AuditEntry table)
website ─┤                                                           ▲
data-sources ┤                                                       │ auditQueries (system)
auth ────┘                                                           │
website: GetWebsiteAuditTrail / GetWebsiteAuditDigest (audit.read) ──┘
```

- **The audit module imports no other module.** That is what lets the auth module, which every other module depends on, feed it too without a cycle. It brands its own `WebsiteId` and `ActorId`.
- **Writing:** a module's `composition.ts` wraps its log adapter with `withAuditTrail`. Its use cases see no difference. `record` returns at once and never throws. The insert runs on its own, and a failure is logged by the repository. Shortcut: a write still in flight when the process stops is lost.
- **What is kept:** each module's `TRAIL_BY_EVENT` (next to `LEVEL_BY_EVENT`) says so per event type. It is exhaustive, so a new event needs a decision. Visitor events are kept when they change something: a booking, a cancellation, a move. Holds, released holds, expiry sweeps and lost races stay in the logs. Sign-in, accounts and the platform's own administrators belong to no website and stay in the logs.
- **Reading:** the audit queries are `@authorization system`. The website module authorizes `audit.read` (administrators) on the loaded website and reads through its `AuditTrailReader` port.
- **Labels:** each module names its own events under `auditEvents.<type>` in its catalog. `src/app/_lib/audit-event-labels.ts` looks them up, and a type without a label is shown as it is.

## Data

`AuditEntry` holds the website, the source module, the event type, `INFO`/`WARN`, the actor kind (`MEMBER`/`VISITOR`/`SYSTEM`; a member's id only, checked by a constraint; a trigger refuses any update of a row), the details as JSON (plain values only), and when it happened. Rows are removed with their website. Every read is scoped to one website, bounded, and served by an index that starts with `websiteId`.

## Retention

An entry is kept `AUDIT_RETENTION_DAYS` days (30-3650, default 365). `PruneAuditTrail` (system) deletes older entries for every website at once. An index on `occurredAt` serves the delete, and each run is logged as `audit.pruned` under `audit.audit`, never into the trail. `startAuditRetention`, called from `instrumentation-node.ts`, runs it at server start and then every 24 hours on the process's own timer. That fits the deployment: one long-lived `next start` server. Several instances deleting the same rows is harmless. If the app moves to serverless functions, swap the timer for a scheduled job that calls the same command.
