# Adding a Repository

Owning rules: [`persistence.md`](../rules/persistence.md), [`boundaries.md`](../rules/boundaries.md), [`errors.md`](../rules/errors.md), [`naming.md`](../rules/naming.md).

## Checklist

1. Define the port in `domain/`, named for the capability (`OrderRepository`). Methods speak domain language and return domain models.
2. Return `ResultAsync` for operations that can fail predictably. Do not expose Prisma types in the port. See [`errors.md`](../rules/errors.md).
3. Create the implementation in `infrastructure/`, named for the technology (`PrismaOrderRepository`). See [`naming.md`](../rules/naming.md).
4. Write a mapper for each direction: Prisma record → domain model, domain model → Prisma persistence shape.
5. Select only the fields the use case needs. Avoid N+1 queries; batch or join instead.
6. Catch Prisma errors inside the repository and map them to typed errors. Never let Prisma errors cross the boundary.
7. Bound every list query with pagination or a limit. See [`performance.md`](../rules/performance.md).
8. Wire the implementation where the module is composed. Use cases receive the port, never the implementation.
9. Add a fake implementation for use case tests.
10. Add an integration test for the real implementation against a test database. See [`testing.md`](../rules/testing.md).

## Done when

- [ ] No Prisma type appears in `domain/` or `application/`
- [ ] Every Prisma error is mapped inside infrastructure
- [ ] The repository has a fake and an integration test
- [ ] List queries are bounded
