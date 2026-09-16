/**
 * Minimal server-side logging abstraction.
 *
 * This intentionally does NOT couple to a specific observability provider
 * (Sentry, Datadog, etc). Swap the implementation of `Logger` later without
 * touching call sites. Never log secrets, tokens, credentials, or sensitive
 * user data — callers are responsible for keeping payloads clean.
 */
type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

export interface Logger {
    info(message: string, payload?: LogPayload): void;
    warn(message: string, payload?: LogPayload): void;
    error(message: string, payload?: LogPayload): void;
}

function write(level: LogLevel, message: string, payload?: LogPayload) {
    const entry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...(payload ? { payload } : {}),
    };

    // A future observability provider can be swapped in here without
    // changing any call site. For the MVP we write structured JSON lines.
    const serialized = JSON.stringify(entry);

    if (level === "error") {
        console.error(serialized);
    } else if (level === "warn") {
        console.warn(serialized);
    } else {
        console.info(serialized);
    }
}

export const logger: Logger = {
    info: (message, payload) => write("info", message, payload),
    warn: (message, payload) => write("warn", message, payload),
    error: (message, payload) => write("error", message, payload),
};
