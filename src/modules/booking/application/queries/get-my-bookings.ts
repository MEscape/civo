import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { MAX_LIST_RANGE_DAYS, MAX_OWN_BOOKINGS } from '../booking-limits';
import { toEmployeeBookingView } from '../booking-view-mappers';
import { scopeOfActor } from '../services/booking-scope';
import { locationsOfBookings } from '../services/booking-zones';
import { parseSpan } from '../services/request-parsing';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingDependencies } from '../booking-dependencies';
import type { GetMyBookingsInput } from '../contracts/booking-inputs';
import type { EmployeeBookingView } from '../contracts/booking-views';

export type GetMyBookingsError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The bookings the signed-in employee serves that start in a span. "Mine" is a condition of the
 * statement (the booking holds a resource whose calendar belongs to this person), not a filter
 * applied to a larger read, and the person comes from the session: there is no id in the request to
 * change. The answer holds no customer data (what an employee may see of a customer is open, P15).
 */
export class GetMyBookings {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: GetMyBookingsInput,
  ): AppResultAsync<readonly EmployeeBookingView[], GetMyBookingsError> {
    const { access, bookings } = this.deps;

    return access.authorizeWebsite('booking.read.own', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return parseSpan(input, MAX_LIST_RANGE_DAYS).asyncAndThen((span) =>
        bookings
          .list(scope, {
            span,
            statuses: ['held', 'confirmed', 'completed', 'no_show'],
            assignedActorId: actor.id,
            limit: MAX_OWN_BOOKINGS,
          })
          .andThen((own) =>
            locationsOfBookings(this.deps, scope, own).map((locations) =>
              own.flatMap((stored) => {
                const location = locations.get(stored.booking.locationId);
                return location === undefined
                  ? []
                  : [toEmployeeBookingView(stored, location.zone, scope.websiteId)];
              }),
            ),
          ),
      );
    });
  }
}
