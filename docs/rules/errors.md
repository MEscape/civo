# Error Handling Rules

- Use `neverthrow` for expected application failures.
- Use `Result` for recoverable business and application errors.
- Use `ResultAsync` for asynchronous operations that can fail predictably.
- Never use exceptions for normal business control flow; reserve `throw` for unexpected programmer or system failures that no caller is expected to recover from.
- Domain errors must be explicit typed errors with stable error codes.
- Application errors must describe actionable failure cases.
- Infrastructure errors must be mapped before crossing the infrastructure boundary.
- Do not expose infrastructure error details to users.
- Presentation layers map error codes to UI or HTTP responses. See [`api.md`](api.md) and [`i18n.md`](i18n.md).
- Do not catch an error unless the layer can meaningfully handle or translate it.
- Preserve the original error as a cause when translating unexpected failures.
- Error types must describe what happened, not how the error was transported. See [`naming.md`](naming.md).
- Log an unexpected error once, at the boundary that handles it. See [`observability.md`](observability.md).
