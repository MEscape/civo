# Adding a Use Case

Owning rules: [`modules.md`](../rules/modules.md), [`errors.md`](../rules/errors.md), [`validation.md`](../rules/validation.md), [`security.md`](../rules/security.md), [`naming.md`](../rules/naming.md).

## Checklist

1. Decide: command (changes state) or query (reads state). Name it per [`naming.md`](../rules/naming.md): `CancelSubscription`, `GetOrderById`.
2. Define the input type and the error union. Errors carry stable codes. See [`errors.md`](../rules/errors.md).
3. Define or extend the domain **port** the use case needs. Do not import Prisma.
4. Implement the use case in `application/`. It returns `Result` / `ResultAsync`.
5. Enforce authorization inside the use case. See [`security.md`](../rules/security.md).
6. Implement the port in `infrastructure/` (repository) and map records to domain models. See [`adding-a-repository.md`](adding-a-repository.md).
7. Add the delivery adapter:
   - Mutation from UI: Server Action in `presentation/actions/`. Validate with Zod first. See [`adding-a-server-action.md`](adding-a-server-action.md).
   - Real HTTP consumer: Route Handler. See [`adding-a-route-handler.md`](adding-a-route-handler.md).
   - Read from a Server Component: call the query directly. See [`nextjs.md`](../rules/nextjs.md).
8. Export it from the module `index.ts` only if other modules or the app need it.
9. Test the use case with port fakes, then the adapter through observable behavior. See [`testing.md`](../rules/testing.md).
10. Invalidate affected caches if the use case mutates cached data. See [`caching.md`](../rules/caching.md).

## Done when

- [ ] Use case has no framework, Prisma, or HTTP imports
- [ ] Every failure path returns a typed error, none throws
- [ ] Authorization is checked in the use case, not only in the UI
