import type { ConflictAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { markNoShow } from '../../domain/lifecycle/booking-lifecycle';
import { toCalendarBookingView } from '../booking-view-mappers';
import { loadAuthorizedBooking } from '../load-authorized-booking';
import { loadBookingParts } from '../services/own-booking';

import type { BookingDependencies } from '../booking-dependencies';
import type { FinishBookingInput } from '../contracts/booking-inputs';
import type { CalendarBookingView } from '../contracts/booking-views';
import type { LoadBookingError } from '../load-authorized-booking';
import type { BookingPartsError } from '../services/own-booking';

/** Staff record that the customer did not come. Only possible once the appointment has begun. */
export class MarkBookingNoShow {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: FinishBookingInput,
  ): AppResultAsync<CalendarBookingView, LoadBookingError | BookingPartsError | ConflictAppError> {
    const { bookings, audit, clock } = this.deps;
    const now = clock.now();

    return loadAuthorizedBooking(this.deps, input.bookingId, 'booking.manage').andThen(
      ({ actor, booking }) =>
        loadBookingParts(
          this.deps,
          { tenantId: actor.tenantId, websiteId: booking.websiteId },
          booking,
        ).andThen(({ service }) =>
          markNoShow(booking, now)
            .asyncAndThen((marked) => bookings.save(marked, booking, now))
            .map((saved) => {
              audit.record({
                type: 'booking.no_show',
                actorId: actor.id,
                tenantId: actor.tenantId,
                websiteId: saved.websiteId,
                bookingId: saved.id,
              });
              return toCalendarBookingView(saved, service.name);
            }),
        ),
    );
  }
}
