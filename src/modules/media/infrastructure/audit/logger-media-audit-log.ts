import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type { MediaAuditLog, MediaEvent } from '../../domain/ports/media-audit-log.port';

/** Failures are `warn` so alerting can key on them. Exhaustive per event type. */
export const LEVEL_BY_EVENT = {
  'media.upload_authorised': 'info',
  'media.upload_completed': 'info',
  'media.upload_rejected': 'warn',
  'media.deleted': 'info',
  'media.abandoned_removed': 'info',
  'media.cleanup_failed': 'warn',
} as const satisfies Record<MediaEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `media.audit`; never throws. Carries ids and facts, never names or links. */
export const loggerMediaAuditLog: MediaAuditLog = createAuditLog('media.audit', LEVEL_BY_EVENT);

/**
 * What the website's audit trail keeps: what a member did to the website's files. An authorised
 * upload is only a promise until it is verified, and cleaning up after an abandoned one is the
 * system's housekeeping; both stay in the logs. Exhaustive per event type.
 */
export const TRAIL_BY_EVENT = {
  'media.upload_authorised': false,
  'media.upload_completed': 'member',
  'media.upload_rejected': 'member',
  'media.deleted': 'member',
  'media.abandoned_removed': false,
  'media.cleanup_failed': false,
} as const satisfies AuditTrailPolicy<MediaEvent['type']>;
