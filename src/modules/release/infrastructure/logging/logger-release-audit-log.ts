import { createAuditLog } from '@lib/logger';

import type { ReleaseAuditLog, ReleaseEvent } from '../../domain/ports/release-audit-log.port';

/** A blocked publish and an incomplete migration are `warn` so alerting can key on them. Exhaustive per event type. */
const LEVEL_BY_EVENT = {
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
