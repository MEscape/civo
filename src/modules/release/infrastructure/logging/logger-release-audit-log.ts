import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type { ReleaseAuditLog, ReleaseEvent } from '../../domain/ports/release-audit-log.port';

/** A blocked publish and an incomplete migration are `warn` so alerting can key on them. Exhaustive per event type. */
export const LEVEL_BY_EVENT = {
  'release.published': 'info',
  'release.rolled_back': 'info',
  'release.publish_blocked': 'warn',
  'release.migration_proposed': 'info',
  'release.migration_applied': 'info',
  'release.migration_apply_incomplete': 'warn',
} as const satisfies Record<ReleaseEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `release.audit`; never throws. */
export const loggerReleaseAuditLog: ReleaseAuditLog = createAuditLog(
  'release.audit',
  LEVEL_BY_EVENT,
);

/** Everything that changes, or failed to change, what visitors see is kept. Exhaustive per event type. */
export const TRAIL_BY_EVENT = {
  'release.published': 'member',
  'release.rolled_back': 'member',
  'release.publish_blocked': 'member',
  'release.migration_proposed': 'member',
  'release.migration_applied': 'member',
  'release.migration_apply_incomplete': 'member',
} as const satisfies AuditTrailPolicy<ReleaseEvent['type']>;
