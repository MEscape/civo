import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type { MapAuditLog, MapEvent } from '../../domain/ports/map-audit-log.port';

/** Dropped features are `warn` so alerting can key on them. Exhaustive per event type. */
export const LEVEL_BY_EVENT = {
  'map.created': 'info',
  'map.updated': 'info',
  'map.deleted': 'info',
  'map.features_dropped': 'warn',
} as const satisfies Record<MapEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `map.audit`; never throws. */
export const loggerMapAuditLog: MapAuditLog = createAuditLog('map.audit', LEVEL_BY_EVENT);

/** Every change to a map is kept; dropped features are operational noise for the logs only. Exhaustive per event type. */
export const TRAIL_BY_EVENT = {
  'map.created': 'member',
  'map.updated': 'member',
  'map.deleted': 'member',
  'map.features_dropped': false,
} as const satisfies AuditTrailPolicy<MapEvent['type']>;
