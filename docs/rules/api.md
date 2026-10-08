# API Rules

- HTTP is a delivery mechanism, not an application layer.
- Route Handlers are only created for real HTTP consumers.
- Every request input that crosses the HTTP boundary — body, query parameters, headers, and route parameters — must be validated. See [`validation.md`](validation.md).
- Authenticate requests before protected operations. See [`security.md`](security.md).
- Authorize operations at the application boundary.
- Route Handlers call application use cases or queries.
- Route Handlers contain no business logic.
- Map application `Result` values into HTTP responses at the boundary; a failed `Result` becomes a specific status code, not a generic 500. See [`errors.md`](errors.md).
- Never expose domain or persistence objects directly; return explicit response DTOs.
- Use consistent HTTP status semantics and a consistent error response shape.
- Do not expose internal exception messages.
- Version public APIs; do not make breaking changes to a published contract.
- Make non-idempotent operations safe to retry where clients may retry.
- HTTP-specific types must not leak into domain or application code.
- Webhooks must validate authenticity before processing payloads. See [`security.md`](security.md).
