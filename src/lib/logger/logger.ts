import 'server-only';

import { serverEnv } from '@lib/config/server';

import { redact } from './redact';

/*
 * Structured logging (observability.md). The rest of the application depends on this interface,
 * not on a logging vendor: swapping the sink means editing this file only. Redaction of sensitive
 * keys lives in `redact.ts`.
 */

/** Severity of a log line; `LOG_LEVEL` sets the minimum that is written. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured fields of a log line. Any key naming a credential is written as `[REDACTED]`. */
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
 * The line for an entry. A context that cannot be serialized (a getter that
 * throws, an object whose `toString` throws) costs only the context: a log call
 * must never throw into the code it observes, least of all from a `catch` block.
 */
function serialize(entry: LogEntry): string {
  try {
    const context = entry.context ? (redact(entry.context) as LogContext) : undefined;
    return JSON.stringify({ ...entry, context });
  } catch {
    return JSON.stringify({ ...entry, context: '[Unserializable]' });
  }
}

function write(entry: LogEntry): void {
  if (!isEnabled(entry.level)) {
    return;
  }

  const line = serialize(entry);

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

/** `String(value)`, except for a value that cannot be converted (`Object.create(null)`), which must not make a log call throw. */
function printable(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unprintable value]';
  }
}

/**
 * An `Error` keeps its stack. An `AppError` is a plain object: its kind and
 * code name it (its `String()` would be "[object Object]"), and an `Error`
 * cause lends its stack.
 */
function normalizeError(error: unknown): {
  name: string;
  message: string;
  stack?: string | undefined;
} {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === 'object' && error !== null && 'kind' in error && 'code' in error) {
    const { kind, code, cause } = error as { kind: unknown; code: unknown; cause?: unknown };
    return {
      name: String(kind),
      message: String(code),
      ...(cause instanceof Error ? { stack: cause.stack } : {}),
    };
  }
  return { name: 'UnknownError', message: printable(error) };
}

function logError(message: string, error: unknown, context?: LogContext): void {
  const normalized = normalizeError(error);

  write({
    level: 'error',
    message,
    timestamp: new Date().toISOString(),
    context,
    error: normalized,
  });
}

/** The four level methods, with `base` (when given) merged under each call's own context. */
function bind(base?: LogContext) {
  const merged = (context?: LogContext): LogContext | undefined =>
    base === undefined ? context : { ...base, ...context };
  return {
    debug: (message: string, context?: LogContext): void => {
      log('debug', message, merged(context));
    },
    info: (message: string, context?: LogContext): void => {
      log('info', message, merged(context));
    },
    warn: (message: string, context?: LogContext): void => {
      log('warn', message, merged(context));
    },
    error: (message: string, error: unknown, context?: LogContext): void => {
      logError(message, error, merged(context));
    },
  };
}

/**
 * The application's logger: `debug`, `info`, `warn` and `error(message, error, context?)`, one JSON
 * line each, filtered by `LOG_LEVEL`. It never throws. Server-only.
 */
export const logger = {
  ...bind(),
  /** Returns a logger with `context` pre-bound, so a module doesn't repeat itself on every call. */
  withContext: (base: LogContext) => bind(base),
};
