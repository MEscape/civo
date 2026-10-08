# Performance Rules

- Do not optimize without a measured problem, except for the defaults listed here.
- Keep the client bundle small: prefer Server Components and avoid heavy client-only libraries. See [`react.md`](react.md).
- Use dynamic imports for large, rarely used client code.
- Use the framework image and font primitives.
- Set explicit dimensions on media to prevent layout shift.
- Stream independent slow UI with Suspense. See [`nextjs.md`](nextjs.md).
- Fetch independent data in parallel, not sequentially.
- Paginate or bound every list-returning query. See [`persistence.md`](persistence.md).
- Avoid unbounded in-memory processing of large datasets.
- Do not add a dependency to save a few lines when it costs bundle size. See [`dependencies.md`](dependencies.md).
