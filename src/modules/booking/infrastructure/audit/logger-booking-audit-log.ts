import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type { BookingAuditLog, BookingEvent } from '../../domain/ports/booking-audit-log.port';

/**
 * A request that lost a race is an expected outcome and not a system failure, so every event is
 * `info`. Exhaustive per event type: a new variant does not compile until its level is chosen.
 */
export const LEVEL_BY_EVENT = {
  'booking.held': 'info',
  'booking.hold_released': 'info',
  'booking.confirmed': 'info',
  'booking.cancelled': 'info',
  'booking.rescheduled': 'info',
  'booking.assigned': 'info',
  'booking.unassigned': 'info',
  'booking.completed': 'info',
  'booking.no_show': 'info',
  'booking.conflict_detected': 'info',
  'booking.preferences_saved': 'info',
  'booking.location_created': 'info',
  'booking.location_updated': 'info',
  'booking.service_created': 'info',
  'booking.service_updated': 'info',
  'booking.service_adopted': 'info',
  'booking.service_deactivated': 'info',
  'booking.service_reactivated': 'info',
  'booking.resource_created': 'info',
  'booking.resource_updated': 'info',
  'booking.team_member_set_up': 'info',
  'booking.team_member_updated': 'info',
  'booking.team_member_removed': 'info',
  'booking.team_member_moved': 'info',
} as const satisfies Record<BookingEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `booking.audit`; never throws. */
export const loggerBookingAuditLog: BookingAuditLog = createAuditLog(
  'booking.audit',
  LEVEL_BY_EVENT,
);

/**
 * What the website's audit trail keeps. A visitor's abandoned hold, its release and a lost race are
 * operational noise that stays in the logs. What changed a booking is kept: by a member when the
 * event names one (`actorId`), by a visitor when it does not. Exhaustive per event type.
 */
export const TRAIL_BY_EVENT = {
  'booking.held': false,
  'booking.hold_released': false,
  'booking.confirmed': 'visitor',
  'booking.cancelled': 'visitor',
  'booking.rescheduled': 'visitor',
  'booking.assigned': 'member',
  'booking.unassigned': 'member',
  'booking.completed': 'member',
  'booking.no_show': 'member',
  'booking.conflict_detected': false,
  // An employee's own sorting wish changes no booking and nothing anyone else relies on.
  'booking.preferences_saved': false,
  'booking.location_created': 'member',
  'booking.location_updated': 'member',
  'booking.service_created': 'member',
  'booking.service_updated': 'member',
  'booking.service_adopted': 'member',
  'booking.service_deactivated': 'member',
  'booking.service_reactivated': 'member',
  'booking.resource_created': 'member',
  'booking.resource_updated': 'member',
  'booking.team_member_set_up': 'member',
  'booking.team_member_updated': 'member',
  'booking.team_member_removed': 'member',
  'booking.team_member_moved': 'member',
} as const satisfies AuditTrailPolicy<BookingEvent['type']>;
