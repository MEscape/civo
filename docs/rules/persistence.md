# Persistence Rules

- Prisma is an infrastructure concern; import rules are enforced in [`boundaries.md`](boundaries.md).
- Prisma models must not cross the infrastructure boundary.
- Repositories implement domain ports.
- Application use cases depend on repository abstractions, not Prisma.
- Map Prisma records into domain models.
- Map domain models into Prisma persistence shapes.
- Do not expose Prisma-generated types as application contracts.
- Keep database queries inside repositories or dedicated infrastructure services.
- Transactions belong in application/infrastructure orchestration, not UI code.
- Keep transaction boundaries aligned with application use cases.
- Database constraints must reinforce important domain invariants.
- Do not use database queries as a substitute for domain rules.
- Select only the fields required by the use case.
- Avoid N+1 queries. See [`performance.md`](performance.md).
- Keep Prisma-specific errors inside infrastructure. See [`errors.md`](errors.md).
- Schema changes ship as reviewed migrations committed with the change; never edit an applied migration.
- Store timestamps in UTC.
- Store money as integer minor units or a decimal type, never as floating point.
