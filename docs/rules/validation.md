# Validation Rules

- Validate all external input at the system boundary.
- Never trust client-side validation.
- Use Zod as the canonical runtime validation library, in the presentation layer: schemas for requests, forms, Server Action input and search parameters. Domain, application and infrastructure do not import Zod (lint enforces it).
- Below the presentation boundary, data of unknown shape (stored JSON, a driver row, a library's error body) is checked with the guards in `@lib/utils` (`objectOf`, `arrayOf`, …), which check shape only; the domain constructors that run next check the rules.
- Define schemas close to the boundary they validate.
- Parse unknown external data before using it.
- Prefer `safeParse` when validation failure is expected application flow.
- Prefer `parse` when invalid input represents a programmer or invariant violation.
- Do not duplicate identical schemas across layers.
- Do not use TypeScript types as runtime validation.
- Do not pass raw `FormData` beyond the presentation boundary.
- Do not pass raw request JSON into application use cases.
- Validate route parameters and search parameters.
- Validate environment variables at application startup. See [`configuration.md`](configuration.md).
- Validate external API responses before mapping them into application types.
- Keep domain invariants in the domain even when Zod validates input.
- Schema naming follows [`naming.md`](naming.md).
