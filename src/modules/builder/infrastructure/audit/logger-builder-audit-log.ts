import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type { BuilderAuditLog, BuilderEvent } from '../../domain/ports/builder-audit-log.port';

/**
 * Scope violations are `warn` so alerting can key on them: a municipal
 * editor submitting structure changes is either a bug or an attack.
 * Exhaustive per event type.
 */
export const LEVEL_BY_EVENT = {
  'page.created': 'info',
  'page.system_created': 'info',
  'page.config_saved': 'info',
  'page.edit_scope_violation': 'warn',
} as const satisfies Record<BuilderEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `builder.audit`; never throws. */
export const loggerBuilderAuditLog: BuilderAuditLog = createAuditLog(
  'builder.audit',
  LEVEL_BY_EVENT,
);

/** Every saved draft is kept: it is the page's history of who changed it. The home page a new website starts with is the system's. Exhaustive per event type. */
export const TRAIL_BY_EVENT = {
  'page.created': 'member',
  'page.system_created': 'system',
  'page.config_saved': 'member',
  'page.edit_scope_violation': 'member',
} as const satisfies AuditTrailPolicy<BuilderEvent['type']>;
