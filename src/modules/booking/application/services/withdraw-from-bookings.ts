import type { ActorId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import { combineAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { withdrawResource } from '../../domain/assignment/booking-assignment';
import { toBookingId } from '../../domain/models/ids';

import { saveChange } from './persist-change';
import { retryOnStale } from './retry-on-stale';

import type { BookableResourceId } from '../../domain/models/ids';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { TeamDependencies } from '../booking-dependencies';

/**
 * Takes an employee off the bookings a change of their calendar left without them, so their units are
 * open again and somebody else can take them (a manager assigns one, or an employee claims it where the
 * service lets employees claim). This is the one answer to "the person is no longer there", whatever the
 * cause: an absence, new hours, being sent to another location, leaving the team. The booking stays
 * confirmed; the employee is told in the same write as for any change to their part (BD-11). A booking
 * that has begun, is not confirmed or no longer names the employee is left as it is. Returns how many
 * were made open. One that cannot be written (it moved on meanwhile and moved again) is left standing: it
 * shows as a booking that has no one there, and saving again takes it off.
 */
export function withdrawFromBookings(
  deps: Pick<TeamDependencies, 'bookings' | 'audit'>,
  request: {
    readonly scope: BookingScope;
    readonly resourceId: BookableResourceId;
    readonly bookingIds: readonly string[];
    /** Who made the change that took the employee away. */
    readonly actorId: ActorId;
    readonly now: Instant;
  },
): AppResultAsync<number, InfrastructureAppError> {
  const { scope, resourceId, actorId, now } = request;
  const withdraw = (bookingId: string) =>
    retryOnStale(() =>
      deps.bookings.findById(scope, toBookingId(bookingId)).andThen((stored) => {
        const next = stored === null ? null : withdrawResource(stored.booking, resourceId, now);
        if (stored === null || next === null) {
          return okAsync(0);
        }
        return saveChange(deps, { scope, before: stored, next, now }).map((saved) => {
          deps.audit.record({
            type: 'booking.unassigned',
            tenantId: scope.tenantId,
            websiteId: scope.websiteId,
            actorId,
            bookingId: saved.booking.id,
            serviceId: saved.booking.serviceId,
            resourceId,
          });
          return 1;
        });
      }),
    ).orElse(() => okAsync(0));
  return combineAsync(request.bookingIds.map(withdraw)).map((counts) =>
    counts.reduce((sum, count) => sum + count, 0),
  );
}
