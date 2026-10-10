import { createAuditLog } from '@lib/logger';

import type { BookingAuditLog, BookingEvent } from '../../domain/ports/booking-audit-log.port';

/**
 * A detected conflict means a visitor lost a race, which is an expected
 * outcome of concurrent use, but one operations want to see climbing, so it
 * is a warning. Exhaustive per event type.
 */
const LEVEL_BY_EVENT = {
  'booking.service_created': 'info',
  'booking.service_updated': 'info',
  'booking.location_created': 'info',
  'booking.location_updated': 'info',
  'booking.resource_created': 'info',
  'booking.resource_updated': 'info',
  'booking.resources_imported': 'info',
  'booking.held': 'info',
  'booking.hold_released': 'info',
  'booking.holds_expired': 'info',
  'booking.confirmed': 'info',
  'booking.cancelled': 'info',
  'booking.rescheduled': 'info',
  'booking.completed': 'info',
  'booking.no_show': 'info',
  'booking.conflict_detected': 'warn',
} as const satisfies Record<BookingEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `booking.audit`; never throws. Events carry ids only. */
export const loggerBookingAuditLog: BookingAuditLog = createAuditLog(
  'booking.audit',
  LEVEL_BY_EVENT,
);
