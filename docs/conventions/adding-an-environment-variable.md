# Adding an Environment Variable

Owning rules: [`configuration.md`](../rules/configuration.md), [`security.md`](../rules/security.md), [`validation.md`](../rules/validation.md), [`naming.md`](../rules/naming.md).

## Checklist

1. Decide server-only or public. Secrets are always server-only. Use `NEXT_PUBLIC_*` only for values that are safe to ship to the browser.
2. Name it in `UPPER_SNAKE_CASE`. See [`naming.md`](../rules/naming.md).
3. Add it to the Zod schema of the typed configuration module, with the right type and a default only when a default is safe.
4. Read it only through the typed configuration module. Never use `process.env` elsewhere.
5. Add it to `.env.example` with a placeholder value and a one-line description. Never commit a real value.
6. Confirm the app fails fast at startup when it is missing or malformed.
7. Set it in each deployment environment before merging.

## Done when

- [ ] The variable is validated at startup
- [ ] No direct `process.env` access outside the config module
- [ ] `.env.example` is updated
- [ ] No secret uses the `NEXT_PUBLIC_` prefix
