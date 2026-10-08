import { logger } from './logger';

/** Failures and denials are `warn` so alerting can key on them; ordinary lifecycle events are `info`. */
export type AuditLevel = 'info' | 'warn';

/** Satisfies any module's audit port whose events have one of the types `T`. */
export interface AuditRecorder<T extends string> {
  record(event: { readonly type: T }): void;
}

/**
 * The one implementation behind every module's audit port: each event
 * becomes one structured log line under `module`, at the level the module
 * chose for its type, with the rest of the event as context. Never throws:
 * auditing must never fail the request it describes. Modules own their
 * event types and levels; this owns the mechanism.
 */
export function createAuditLog<T extends string>(
  module: string,
  levels: Readonly<Record<T, AuditLevel>>,
): AuditRecorder<T> {
  const auditLogger = logger.withContext({ module });
  return {
    record(event) {
      const { type, ...details } = event;
      try {
        auditLogger[levels[type]](type, details);
      } catch {
        // Contained on purpose, see above.
      }
    },
  };
}
