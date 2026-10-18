import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type { WebsiteAuditLog, WebsiteEvent } from '../../domain/ports/website-audit-log.port';

/** Failures are `warn` so alerting can key on them. Exhaustive per event type. */
export const LEVEL_BY_EVENT = {
  'website.created': 'info',
  'website.updated': 'info',
  'website.theme_updated': 'info',
  'website.provisioning_rollback_failed': 'warn',
} as const satisfies Record<WebsiteEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `website.audit`; never throws. */
export const loggerWebsiteAuditLog: WebsiteAuditLog = createAuditLog(
  'website.audit',
  LEVEL_BY_EVENT,
);

/** Every change to a website is kept; a failed clean-up after a failed creation is the system's. Exhaustive per event type. */
export const TRAIL_BY_EVENT = {
  'website.created': 'member',
  'website.updated': 'member',
  'website.theme_updated': 'member',
  'website.provisioning_rollback_failed': 'system',
} as const satisfies AuditTrailPolicy<WebsiteEvent['type']>;
