import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { assignmentChangesOf } from '../../domain/assignment/booking-assignment';
import { bookingNotFound } from '../../domain/errors/booking-errors';
import { heldResourceIds } from '../../domain/models/booking';
import { toBookingView } from '../booking-view-mappers';
import { currentInstant } from '../services/clock-instant';
import { mayContactCustomers } from '../services/contact-access';
import { findBooking } from '../services/find-booking';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { BookingTargetInput } from '../contracts/booking-inputs';
import type { BookingDetailView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';

export type GetBookingError =
  BookingAccessError | FindBookingError | NotFoundAppError | InfrastructureAppError;

/**
 * One booking, as far as the signed-in person may see it. Who manages bookings sees any of them, who
 * booked included; who may only look at them (`booking.read`, a viewer) sees any of them without who
 * booked. An employee sees only a booking they serve, found through their own calendar, and without
 * the customer (BD-26); any other booking, and any booking of another website, is "not found" for
 * them, the same answer as a missing one. `staffChanges` is the domain's rule for replacing and
 * removing an employee, so the panel offers exactly what the commands accept.
 */
export class GetBooking {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: BookingTargetInput): AppResultAsync<BookingDetailView, GetBookingError> {
    const { access } = this.deps;
    const now = currentInstant(this.deps.clock);
    return access
      .authorizeWebsite('booking.read.own', input.websiteId)
      .andThen(({ actor }) => findBooking(this.deps, actor, input.bookingId))
      .andThen(({ actor, scope, stored, service, location }) => {
        const view = {
          ...toBookingView(stored, location.zone, scope.websiteId),
          staffChanges: assignmentChangesOf(stored.booking, service, now),
        };
        return mayContactCustomers(access, input.websiteId).andThen((withCustomer) =>
          withCustomer
            ? okAsync<BookingDetailView, GetBookingError>(view)
            : access
                .authorizeWebsite('booking.read', input.websiteId)
                .map(() => ({ ...view, customer: null }))
                .orElse(() => this.ownOnly(actor, scope, { stored, view })),
        );
      });
  }

  private ownOnly(
    actor: Actor,
    scope: BookingScope,
    found: { readonly stored: StoredBooking; readonly view: BookingDetailView },
  ): AppResultAsync<BookingDetailView, GetBookingError> {
    return this.deps.resources
      .findEmployeeOf(scope, actor.id)
      .andThen((own) =>
        own !== null && heldResourceIds(found.stored.booking).includes(own.id)
          ? okAsync({ ...found.view, customer: null })
          : errAsync(bookingNotFound()),
      );
  }
}
