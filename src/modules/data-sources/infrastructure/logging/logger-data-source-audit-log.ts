import { createAuditLog } from '@lib/logger';

import type {
  DataSourceAuditLog,
  DataSourceEvent,
} from '../../domain/ports/data-source-audit-log.port';

/**
 * A failed connection test is a recorded outcome, not a system failure, so
 * every event is `info`. Exhaustive per event type.
 */
const LEVEL_BY_EVENT = {
  'data_source.created': 'info',
  'data_source.tested': 'info',
  'data_source.deleted': 'info',
  'dataset.created': 'info',
  'dataset.updated': 'info',
  'dataset.mapping_saved': 'info',
  'dataset.deleted': 'info',
} as const satisfies Record<DataSourceEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `data-source.audit`; never throws. */
export const loggerDataSourceAuditLog: DataSourceAuditLog = createAuditLog(
  'data-source.audit',
  LEVEL_BY_EVENT,
);
