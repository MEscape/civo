# Adding a Shared Utility

Owning rules: [`shared.md`](../rules/shared.md), [`architecture.md`](../rules/architecture.md), [`dependencies.md`](../rules/dependencies.md), [`naming.md`](../rules/naming.md).

## Checklist

1. Check the platform first (`structuredClone`, `Object.hasOwn`, `Object.groupBy`, `Intl`). Do not reimplement it. See [`dependencies.md`](../rules/dependencies.md).
2. Check whether it is genuinely generic. If it mentions a domain concept, Prisma, or HTTP, it belongs in the owning module. See [`shared.md`](../rules/shared.md).
3. Check the use count. Extract only after a third independent use.
4. Put it in the file for its concern (`array.ts`, `string.ts`, `async.ts`). Never create `helpers.ts` or `misc.ts`. See [`naming.md`](../rules/naming.md).
5. If it needs a third-party library, give it its own file so dependency-free utilities stay dependency-free.
6. Return a `Result` for predictable failures; throw only for programmer errors, and say so in the doc comment. See [`errors.md`](../rules/errors.md).
7. Write a doc comment describing behavior and constraints. Do not mention domain concepts. See [`comments.md`](../rules/comments.md).
8. Export it from the shared `index.ts`.
9. Add unit tests, including edge cases and invalid input. Shared code has no other safety net.

## Done when

- [ ] No domain, Prisma, or HTTP knowledge in the function or its comments
- [ ] The platform does not already provide it
- [ ] It has unit tests and a public export
