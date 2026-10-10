import type { AppResultAsync } from '@lib/result';

import { toCalendarBookingView } from '../booking-view-mappers';
import { loadAuthorizedBooking } from '../load-authorized-booking';
import { cancelWithPolicy } from '../services/booking-changes';
import { loadBookingParts } from '../services/own-booking';

import type { BookingDependencies } from '../booking-dependencies';
import type { CancelBookingAsStaffInput } from '../contracts/booking-inputs';
import type { CalendarBookingView } from '../contracts/calendar-views';
import type { LoadBookingError } from '../load-authorized-booking';
import type { BookingChangeError } from '../services/booking-changes';

/**
 * Staff cancel a booking on a customer's behalf. The service's policy still
 * decides whether cancellation is possible at all and for staff; its
 * deadline binds customers only.
 */
export class CancelBookingAsStaff {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: CancelBookingAsStaffInput,
  ): AppResultAsync<CalendarBookingView, LoadBookingError | BookingChangeError> {
    const { audit } = this.deps;

    return loadAuthorizedBooking(this.deps, input.bookingId, 'booking.manage').andThen(
      ({ actor, booking }) =>
        loadBookingParts(
          this.deps,
          { tenantId: actor.tenantId, websiteId: booking.websiteId },
          booking,
        )
          .andThen((parts) =>
            cancelWithPolicy(this.deps, parts, 'staff').map((cancelled) => ({
              cancelled,
              serviceName: parts.service.name,
            })),
          )
          .map(({ cancelled, serviceName }) => {
            audit.record({
              type: 'booking.cancelled',
              tenantId: actor.tenantId,
              websiteId: cancelled.websiteId,
              bookingId: cancelled.id,
              by: 'staff',
            });
            return toCalendarBookingView(cancelled, serviceName);
          }),
    );
  }
}
