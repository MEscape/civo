# Caching Rules

- Every cache must have an explicit ownership and invalidation strategy.
- Cache only data whose consistency requirements permit caching.
- Never cache secrets.
- Cache keys must include every value that affects the result, including user or tenant identity when the result varies by them.
- Prefer precise cache invalidation over broad invalidation.
- Mutations must invalidate all affected cache entries.
- Do not introduce caching as a workaround for inefficient application logic.
- Do not cache authorization decisions without an explicit identity boundary. See [`security.md`](security.md).
- Document non-obvious cache lifetimes. See [`comments.md`](comments.md).
- Prefer framework cache primitives at the delivery boundary.
- Keep business logic independent of the caching implementation.
