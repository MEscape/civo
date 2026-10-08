# Testing Rules

- Test behavior, not implementation details.
- Unit-test domain rules independently.
- Unit-test application use cases with port fakes.
- Test infrastructure adapters against their real contracts.
- Test validation schemas at their boundaries.
- Test Server Actions through their observable behavior.
- Test Client Components through user interaction, querying by role and accessible name.
- Use integration tests for important persistence workflows.
- Use end-to-end tests for critical user journeys.
- Do not mock the system under test.
- Prefer fakes over mocks; assert on outcomes, not call counts.
- Keep tests deterministic: inject clocks and randomness, and never depend on test order or shared state.
- Do not test framework behavior owned by Next.js or Prisma.
- A bug fix ships with a test that fails without the fix.
- Test file naming follows [`naming.md`](naming.md).
