import type { AppResultAsync } from '@lib/result';

import { loadScheduling } from './scheduling-context';

import type { BookingContext } from './booking-context';
import type { SchedulingError } from './scheduling-context';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { Scheduling } from '../../domain/scheduling/scheduling-types';
import type { Instant } from '../../domain/time/instant';
import type { LocalDateRange } from '../../domain/time/local-date-range';
import type { BookingFlowDependencies } from '../booking-dependencies';

/**
 * The scheduling question for moving a visitor's own booking: its own service and location as they
 * are stored, the customer's notice and horizon, and the booking itself not blocking its new time.
 * The times offered and the move that is saved are judged by this one question, so a time offered
 * is a time the move accepts (`GetOwnBookingSlots`, `RescheduleOwnBooking`).
 */
export function loadOwnBookingScheduling(
  deps: Pick<BookingFlowDependencies, 'bookings' | 'resources'>,
  request: {
    readonly scope: BookingScope;
    readonly own: BookingContext;
    readonly range: LocalDateRange;
    readonly now: Instant;
  },
): AppResultAsync<Scheduling, SchedulingError> {
  const { scope, own, range, now } = request;
  return loadScheduling(deps, {
    scope,
    service: own.service,
    location: own.location,
    range,
    now,
    startRules: 'customer',
    ignoreBookingId: own.stored.booking.id,
  });
}
