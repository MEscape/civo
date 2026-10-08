import { createAuditLog } from '@lib/logger';

import type { SecurityAuditLog, SecurityEvent } from '../../domain/ports/security-audit-log.port';

/**
 * Failures and denials are `warn` so alerting can key on them; ordinary
 * lifecycle events are `info`. Exhaustive: a new event type does not
 * compile until it is given a level.
 */
const LEVEL_BY_EVENT = {
  'authorization.denied': 'warn',
  'authentication.sign_in_failed': 'warn',
  'authentication.rate_limited': 'warn',
  'authentication.session_created': 'info',
  'authentication.session_revoked': 'info',
  'authentication.account_created': 'info',
  'authentication.password_reset_completed': 'info',
} as const satisfies Record<SecurityEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `auth.audit`; never throws. */
export const loggerSecurityAuditLog: SecurityAuditLog = createAuditLog(
  'auth.audit',
  LEVEL_BY_EVENT,
);
