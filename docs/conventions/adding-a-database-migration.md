# Adding a Database Migration

Owning rules: [`persistence.md`](../rules/persistence.md), [`boundaries.md`](../rules/boundaries.md), [`testing.md`](../rules/testing.md).

## Checklist

1. Change `schema.prisma`. Keep Prisma-specific concerns in infrastructure.
2. Run `npm run db:generate` (emits `src/lib/db/contract.*`), then `npx prisma migration plan --name <slug>`. Review the generated operations before committing.
3. Check destructive changes (drop column, type change, new NOT NULL). Use a multi-step approach: add nullable, backfill, then enforce.
4. Store timestamps in UTC and money as integer minor units or a decimal type. See [`persistence.md`](../rules/persistence.md).
5. Add constraints and indexes that back domain invariants and known query paths. Constraints reinforce domain rules; they do not replace them.
6. Update the repository mappers and any affected domain models.
7. Run the integration tests against the migrated schema.
8. Commit the migration with the code change that needs it. Never edit an applied migration; add a new one.

## What the schema already guarantees

Follow these when you add a table or column; the first four are enforced by the database, not by convention.

- **Tenant boundary.** A table below a website carries `websiteId` (and `tenantId` where code scopes by tenant) and points at each parent by the pair, `(parentId, websiteId)`, so a row can never join two websites. The parent declares `@@unique([id, websiteId])`.
- **`@@check` for every domain limit** (lengths, ranges, formats, JSON shape with `jsonb_typeof`, status/timestamp pairs). Name them `<Table>_<what>_rule`: `<Table>_<column>_check` is the shape Prisma reserves for the checks it derives itself.
- **Closed value sets are enums** (`ActorRole`, `ResourceType`, statuses). `__tests__/src/lib/db/contract-enums.test.ts` fails when an enum drifts from the domain list.
- **`updatedAt` is stamped by a trigger** (`set_updated_at`) when the writer leaves it alone. A new table with `updatedAt` needs a trigger line in the migration; `Booking` is the exception because its `updatedAt` is the compare-and-swap token.
- Prisma adds an index for every foreign key by itself. Declare an `@@index` only for a query path beyond that, and use `where:` for partial indexes.
- What PSL cannot express (extensions, exclusion constraints, triggers, functions) is a `rawSql` operation appended to the migration's `migration.ts`. Re-run `node migration.ts` in that folder afterwards to rewrite `ops.json` and the hash, then `npx prisma migration check`.
- Run `npm run db:verify` and the integration tests (`npm run test:integration`, which uses `DATABASE_URL`) against the migrated database.

## Done when

- [ ] The migration SQL was reviewed
- [ ] Destructive steps are staged safely
- [ ] Mappers and integration tests are updated
- [ ] The migration is committed with the change that uses it
