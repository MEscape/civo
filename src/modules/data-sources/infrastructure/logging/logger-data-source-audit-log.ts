import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type {
  DataSourceAuditLog,
  DataSourceEvent,
} from '../../domain/ports/data-source-audit-log.port';

/**
 * A failed connection test is a recorded outcome, not a system failure, so
 * every event is `info`. Exhaustive per event type.
 */
export const LEVEL_BY_EVENT = {
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

/** Every change to a source or dataset is kept, and so is a connection test: it changes what the source reports. Exhaustive per event type. */
export const TRAIL_BY_EVENT = {
  'data_source.created': 'member',
  'data_source.tested': 'member',
  'data_source.deleted': 'member',
  'dataset.created': 'member',
  'dataset.updated': 'member',
  'dataset.mapping_saved': 'member',
  'dataset.deleted': 'member',
} as const satisfies AuditTrailPolicy<DataSourceEvent['type']>;
