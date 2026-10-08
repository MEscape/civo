# Security Rules

- Treat all client input as untrusted. See [`validation.md`](validation.md).
- Authenticate every protected operation.
- Authorize every protected use case.
- Never rely on UI visibility for authorization.
- Server Actions must enforce authorization independently.
- Never expose secrets to Client Components.
- Never log credentials, tokens, session secrets, or sensitive personal data. See [`observability.md`](observability.md).
- Do not trust client-provided user or tenant identifiers for authorization.
- Derive authenticated identity from the server-side authentication context.
- Enforce tenant isolation at the application/data-access boundary.
- Rate-limit and bound the size of externally reachable inputs, including webhooks and public API routes.
- Validate webhook authenticity (signature and replay protection) before processing.
- Protect state-changing requests against CSRF; use secure, `HttpOnly`, `SameSite` cookies for sessions.
- Set standard security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame protections).
- Never render untrusted content as raw HTML; sanitize it first if unavoidable.
- Prefer allowlists over blocklists for security-sensitive decisions.
