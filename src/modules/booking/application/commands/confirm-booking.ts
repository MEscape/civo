import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { bookingNotFound, tooManyActiveBookings } from '../../domain/errors/booking-errors';
import { confirmBooking as confirmHold } from '../../domain/lifecycle/booking-lifecycle';
import { createBookingCustomer, normalizeEmail } from '../../domain/models/booking-customer';
import { parseBookingId } from '../../domain/models/ids';
import { MAX_LIVE_BOOKINGS_PER_EMAIL } from '../booking-limits';
import { toBookingView } from '../booking-view-mappers';
import { notifyCustomer } from '../services/booking-notice';
import { loadBookingParts } from '../services/own-booking';
import { resolvePublicScope } from '../services/public-scope';

import type { Booking } from '../../domain/models/booking';
import type { BookingFlowDependencies } from '../booking-dependencies';
import type { ConfirmBookingInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { BookingPartsError } from '../services/own-booking';
import type { PublicScopeError } from '../services/public-scope';

/**
 * Turns a hold into a booking once the visitor's details are in. The details
 * are validated against what THIS service asks for (server side, whatever
 * the form showed); the write is conditional on the hold being unchanged and
 * unexpired, so a hold that lapsed or was released cannot be confirmed.
 * Confirming the same hold twice with the same address answers with the same
 * booking, so a double click or a retried request is harmless.
 *
 * @authorization public The hold id is an unguessable capability issued to the visitor who made the hold.
 */
export class ConfirmBooking {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(
    input: ConfirmBookingInput,
  ): AppResultAsync<
    BookingView,
    | PublicScopeError
    | BookingPartsError
    | ValidationAppError
    | ConflictAppError
    | NotFoundAppError
    | InfrastructureAppError
  > {
    const { bookings, audit, clock } = this.deps;
    const now = clock.now();

    return resolvePublicScope(this.deps, input.websiteId).andThen((scope) =>
      parseBookingId(input.holdId)
        .asyncAndThen((id) => bookings.findById(id, scope.tenantId))
        .andThen((hold): AppResultAsync<Booking, NotFoundAppError> =>
          hold?.websiteId === scope.websiteId ? okAsync(hold) : errAsync(bookingNotFound()),
        )
        .andThen((hold) => loadBookingParts(this.deps, scope, hold))
        .andThen(({ booking, service, location }) =>
          createBookingCustomer(service, input.customer).asyncAndThen((customer) => {
            if (booking.status === 'confirmed') {
              const isSameVisitor = booking.customer?.email === customer.email;
              return isSameVisitor
                ? okAsync(toBookingView({ booking, service, location }, now))
                : errAsync(bookingNotFound());
            }
            return bookings
              .countLiveByEmail(scope, normalizeEmail(customer.email), now)
              .andThen((live) =>
                live >= MAX_LIVE_BOOKINGS_PER_EMAIL
                  ? errAsync(tooManyActiveBookings())
                  : confirmHold(booking, customer, now).asyncAndThen((confirmed) =>
                      bookings.save(confirmed, booking, now),
                    ),
              )
              .andThen((saved) => {
                audit.record({
                  type: 'booking.confirmed',
                  tenantId: scope.tenantId,
                  websiteId: scope.websiteId,
                  bookingId: saved.id,
                  serviceId: service.id,
                });
                const stored = { booking: saved, service, location };
                return notifyCustomer(this.deps.notifier, 'confirmed', stored).map(() =>
                  toBookingView(stored, now),
                );
              });
          }),
        ),
    );
  }
}
