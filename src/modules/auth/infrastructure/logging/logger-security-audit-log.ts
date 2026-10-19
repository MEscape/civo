import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type { SecurityAuditLog, SecurityEvent } from '../../domain/ports/security-audit-log.port';

/**
 * Failures and denials are `warn` so alerting can key on them; ordinary
 * lifecycle events are `info`. Exhaustive: a new event type does not
 * compile until it is given a level.
 */
export const LEVEL_BY_EVENT = {
  'authorization.denied': 'warn',
  'authentication.sign_in_failed': 'warn',
  'authentication.session_created': 'info',
  'authentication.session_revoked': 'info',
  'authentication.account_created': 'info',
  'authentication.password_reset_completed': 'info',
  'membership.roles_changed': 'info',
  'membership.removed': 'info',
  'platform_admin.granted': 'warn',
  'platform_admin.revoked': 'warn',
  'invitation.created': 'info',
  'invitation.accepted': 'info',
  'invitation.revoked': 'info',
} as const satisfies Record<SecurityEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `auth.audit`; never throws. */
export const loggerSecurityAuditLog: SecurityAuditLog = createAuditLog(
  'auth.audit',
  LEVEL_BY_EVENT,
);

/** What happens to a website's members and who was refused in it is kept. Signing in and out, accounts and the platform's own administrators belong to no website: they stay in the logs. Someone accepting an invitation is not a member yet, so it is a visitor's act. Exhaustive per event type. */
export const TRAIL_BY_EVENT = {
  'authorization.denied': 'member',
  'authentication.sign_in_failed': false,
  'authentication.session_created': false,
  'authentication.session_revoked': false,
  'authentication.account_created': false,
  'authentication.password_reset_completed': false,
  'membership.roles_changed': 'member',
  'membership.removed': 'member',
  'platform_admin.granted': false,
  'platform_admin.revoked': false,
  'invitation.created': 'member',
  'invitation.accepted': 'visitor',
  'invitation.revoked': 'member',
} as const satisfies AuditTrailPolicy<SecurityEvent['type']>;
