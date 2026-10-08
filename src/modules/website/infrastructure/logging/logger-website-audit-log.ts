import { createAuditLog } from '@lib/logger';

import type { WebsiteAuditLog, WebsiteEvent } from '../../domain/ports/website-audit-log.port';

/** Failures are `warn` so alerting can key on them. Exhaustive per event type. */
const LEVEL_BY_EVENT = {
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
