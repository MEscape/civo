# Adding a Database Migration

Owning rules: [`persistence.md`](../rules/persistence.md), [`boundaries.md`](../rules/boundaries.md), [`testing.md`](../rules/testing.md).

## Checklist

1. Change `schema.prisma`. Keep Prisma-specific concerns in infrastructure.
2. Generate a migration with a descriptive name. Review the generated SQL before committing.
3. Check destructive changes (drop column, type change, new NOT NULL). Use a multi-step approach: add nullable, backfill, then enforce.
4. Store timestamps in UTC and money as integer minor units or a decimal type. See [`persistence.md`](../rules/persistence.md).
5. Add constraints and indexes that back domain invariants and known query paths. Constraints reinforce domain rules; they do not replace them.
6. Update the repository mappers and any affected domain models.
7. Run the integration tests against the migrated schema.
8. Commit the migration with the code change that needs it. Never edit an applied migration; add a new one.

## Done when

- [ ] The migration SQL was reviewed
- [ ] Destructive steps are staged safely
- [ ] Mappers and integration tests are updated
- [ ] The migration is committed with the change that uses it
