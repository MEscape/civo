# Adding a Route Handler

Owning rules: [`api.md`](../rules/api.md), [`nextjs.md`](../rules/nextjs.md), [`validation.md`](../rules/validation.md), [`security.md`](../rules/security.md), [`errors.md`](../rules/errors.md).

## Checklist

1. Confirm a real HTTP consumer exists (webhook, mobile client, third party). If the caller is your own UI, use a Server Action or a Server Component instead.
2. Create `route.ts` under `app/api/...`. Keep it thin; it calls a use case.
3. Validate body, query, headers, and route params with Zod. See [`validation.md`](../rules/validation.md).
4. Authenticate before any protected operation, then authorize inside the use case. See [`security.md`](../rules/security.md).
5. Call the use case and map the `Result` to a specific status code and the project's error response shape. See [`errors.md`](../rules/errors.md).
6. Return an explicit response DTO. Never return domain or persistence objects.
7. For webhooks: verify signature and replay protection before parsing the payload.
8. Apply rate limiting and a body size limit on public endpoints.
9. Make retry-prone operations idempotent.
10. Test success, invalid input, unauthenticated, unauthorized, and each mapped failure.

## Done when

- [ ] The handler contains no business logic
- [ ] Every input source is validated
- [ ] Status codes are specific, never a blanket 500
- [ ] No internal error message reaches the response
