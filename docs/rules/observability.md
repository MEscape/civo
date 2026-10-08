# Observability Rules

- Use structured logging.
- Do not use `console.log` for application observability.
- Log at application/infrastructure boundaries, not inside domain code.
- Never log secrets or sensitive data. See [`security.md`](security.md).
- Preserve useful error causes when translating errors. See [`errors.md`](errors.md).
- Include request/correlation identifiers where available.
- Record important application failures with sufficient context.
- Instrument external integrations and important persistence operations.
- Use log levels consistently: `error` for unexpected failures, `warn` for recoverable anomalies, `info` for significant events, `debug` for diagnostics.
- Audit events go through the module's audit port, built with `createAuditLog('<module>.audit', LEVEL_BY_EVENT)` from `@lib/logger`; the module owns the event types and their levels, and a new event type does not compile until it has one.
