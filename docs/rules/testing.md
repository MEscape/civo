# Testing Rules

- Test behavior, not implementation details.
- Mirror the source directory hierarchy under `__tests__/src`, including module layers, component groups, hooks, locale plumbing, and route segments. Split suites that mix unrelated responsibilities; keep reusable fixtures in nearby `support/` directories.
- Unit-test domain rules independently.
- Unit-test application use cases with port fakes.
- Test infrastructure adapters against their real contracts.
- Test validation schemas at their boundaries.
- Test Server Actions through observable behavior.
- Test Client Components through user interactions, querying by role and accessible name.
- Integration-test important persistence workflows.
- End-to-end test critical user journeys.
- Do not mock the system under test. Prefer fakes; assert outcomes, not call counts.
- Keep tests deterministic: inject clocks and randomness; never depend on test order or shared state.
- Do not test behavior owned by Next.js or Prisma.
- Every bug fix must include a test that fails without the fix.
- Follow [naming.md](naming.md) for test filenames.
