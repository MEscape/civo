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
- Public sign-up is closed. Accounts are created only through an administrator's single-use, expiring invitation; only the hash of the invitation token is stored. An address that already has an account is granted the role directly, without an email, so the invitation answer tells an administrator whether that address has an account. The last administrator of a tenant and one's own access cannot be removed or changed.
- Roles are enforced in the use case that serves the data (`booking.read.own` limits an employee to the resources assigned to them); the UI hides what a role cannot use, and is never the protection.
