import { serverEnv } from '@lib/config';

/**
 * Structured logging abstraction (observability.md: "use structured
 * logging", "do not use console.log for application observability").
 *
 * This wraps the actual sink so the rest of the app depends on this
 * interface, not a specific logging vendor — swapping Pino/Datadog/etc.
 * later means editing this file only, same pattern as the data-provider
 * swap described in modules.md for infrastructure.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Correlation/request id — observability.md: "include request/correlation identifiers where available". */
  requestId?: string;
  userId?: string;
  module?: string;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext | undefined;
  error?: { name: string; message: string; stack?: string | undefined };
}

/**
 * Ordering used to compare the configured minimum level against an
 * entry's level. observability.md: "use log levels consistently" — the
 * comparison, not just the four names, is what makes `LOG_LEVEL` actually
 * filter anything.
 */
const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * The minimum level this process emits, read once from `serverEnv`
 * (configuration.md: centralize environment access) rather than branching
 * on `NODE_ENV` at each call site. A call below this level is dropped
 * before it reaches the sink, so callers (e.g. the Prisma query logger)
 * can unconditionally log at `debug` and rely on this to decide whether
 * that ever becomes visible output — set `LOG_LEVEL=debug` locally for
 * full per-query detail, `LOG_LEVEL=warn` (or higher) in production to
 * surface only slow/failed queries and above.
 */
const minSeverity = LEVEL_SEVERITY[serverEnv.LOG_LEVEL];

function isEnabled(level: LogLevel): boolean {
  return LEVEL_SEVERITY[level] >= minSeverity;
}

/**
 * Keys that must never appear in a log line, redacted regardless of
 * nesting depth. security.md / observability.md: "never log credentials,
 * tokens, session secrets, or sensitive personal data."
 *
 * Matching is case-insensitive: `Authorization`, `AUTHORIZATION`, and
 * `authorization` must all be redacted, since header/casing conventions
 * differ by source and a sensitive value must never survive just because
 * its key was capitalized differently than expected.
 */
const REDACTED_KEYS = new Set([
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'sessiontoken',
  'creditcard',
]);

function isRedactedKey(key: string): boolean {
  return REDACTED_KEYS.has(key.toLowerCase());
}

/**
 * True only for objects created by `{}`, `new Object()`, or with a null
 * prototype — the shapes whose own enumerable properties are meaningful
 * "data" to redact and re-serialize. Everything else (`Date`, `Map`,
 * `RegExp`, class instances, etc.) is treated as an opaque value instead:
 * most of those types carry their real content outside own enumerable
 * properties, so recursing into them with `Object.entries` silently
 * produces `{}` and throws the information away.
 */
function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function redact(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  if (Array.isArray(value)) {
    seen.add(value);
    return value.map((item) => redact(item, seen));
  }

  if (!isPlainObject(value)) {
    // Opaque: keep it recognizable in the log line without pretending to
    // redact fields inside it. Errors are handled separately via the
    // `error` field on LogEntry, so a bare Error reaching here is already
    // an edge case, not the primary path.
    if (value instanceof Date) {
      return value.toISOString();
    }
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- intentional fallback for opaque objects
    return String(value);
  }

  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = isRedactedKey(key) ? '[REDACTED]' : redact(val, seen);
  }
  return result;
}

function write(entry: LogEntry): void {
  if (!isEnabled(entry.level)) {
    return;
  }

  const safeContext = entry.context ? (redact(entry.context) as LogContext) : undefined;
  const line = JSON.stringify({ ...entry, context: safeContext });

  // The transport is intentionally the only console.* usage in the
  // codebase — everything else must go through `logger`.
  // no-console is disabled for this file at the ESLint config level.
  if (entry.level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  write({ level, message, timestamp: new Date().toISOString(), context });
}

/**
 * Logs an AppError. Accepts `cause` internally for the entry, but never
 * forwards it to a user-facing surface — that boundary is enforced in
 * lib/errors, not here.
 */
function logError(message: string, error: unknown, context?: LogContext): void {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: 'UnknownError', message: String(error) };

  write({
    level: 'error',
    message,
    timestamp: new Date().toISOString(),
    context,
    error: normalized,
  });
}

export const logger = {
  debug: (message: string, context?: LogContext): void => {
    log('debug', message, context);
  },
  info: (message: string, context?: LogContext): void => {
    log('info', message, context);
  },
  warn: (message: string, context?: LogContext): void => {
    log('warn', message, context);
  },
  error: logError,
  /** Returns a logger with `context` pre-bound, so a module doesn't repeat itself on every call. */
  withContext(base: LogContext) {
    return {
      debug: (message: string, context?: LogContext): void => {
        log('debug', message, { ...base, ...context });
      },
      info: (message: string, context?: LogContext): void => {
        log('info', message, { ...base, ...context });
      },
      warn: (message: string, context?: LogContext): void => {
        log('warn', message, { ...base, ...context });
      },
      error: (message: string, error: unknown, context?: LogContext): void => {
        logError(message, error, { ...base, ...context });
      },
    };
  },
};
