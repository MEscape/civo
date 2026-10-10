# Configuration Rules

- Environment variables are infrastructure/configuration concerns.
- Validate environment variables at startup. See [`validation.md`](validation.md).
- Separate server-only and public configuration: `@lib/config/server` imports `server-only` and holds everything secret; `@lib/config` holds only values safe for the browser.
- A subsystem's variables are required only while that subsystem is on (authentication variables only when `AUTH_ENABLED=true`). Database configuration is always required. Production never allows authentication to be off.
- Use `NEXT_PUBLIC_*` only for intentionally public values; secrets must never use this prefix. See [`security.md`](security.md).
- Do not access `process.env` throughout application code.
- Centralize environment access behind typed configuration.
- Do not hard-code environment-specific behavior.
- Fail fast when required configuration is missing.
- Never commit secrets or credentials.
