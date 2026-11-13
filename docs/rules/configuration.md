# Configuration Rules

- Treat environment variables as infrastructure/configuration concerns.
- Validate configuration at startup. See [validation.md](validation.md).
- Keep server-only configuration in @lib/config/server, which imports server-only. Keep browser-safe values in @lib/config.
- Require subsystem configuration only when that subsystem is enabled; database configuration is always required.
- Production requires authentication and rate limiting (`AUTH_ENABLED`, `RATE_LIMIT_ENABLED`), with a shared rate-limit store secured by a secret of at least 32 characters. `RATE_LIMIT_ENABLED=false` skips the limiter outside production and then needs no rate-limit settings; there is no process-local rate-limit backend.
- Give each domain's schema its own `superRefine` with its rules; only rules that need `NODE_ENV` or compare domains belong in `env-schema.ts`.
- Mail defaults to MAIL_PROVIDER=none. Require the chosen provider's settings and reject settings for unselected providers.
- Object storage is always required, like the database; it has no off switch. Require its endpoint, credentials and at least one bucket (Neon Object Storage in production); buckets are addressed by path. In production, require HTTPS for the storage endpoint and public origin.
- Use NEXT_PUBLIC_* only for intentionally public values; never expose secrets through this prefix. See [security.md](security.md).
- Centralize environment access behind typed configuration. Do not access process.env throughout application code.
- Do not hard-code environment-specific behavior.
- Fail fast when required configuration is missing.
- Never commit secrets or credentials.
