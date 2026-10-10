import type { AppResultAsync } from '@lib/result';

import { toCalendarBookingView } from '../booking-view-mappers';
import { loadAuthorizedBooking } from '../load-authorized-booking';
import { rescheduleWithPolicy } from '../services/booking-changes';
import { loadBookingParts } from '../services/own-booking';

import type { BookingDependencies } from '../booking-dependencies';
import type { RescheduleBookingAsStaffInput } from '../contracts/booking-inputs';
import type { CalendarBookingView } from '../contracts/calendar-views';
import type { LoadBookingError } from '../load-authorized-booking';
import type { BookingChangeError } from '../services/booking-changes';

/**
 * Staff move a booking to another start time (the operations calendar's
 * drag and drop). The new time is assessed and stored exactly like a
 * customer's move, but staff are not held to the customer deadline or the
 * customer's reschedule cap.
 */
export class RescheduleBookingAsStaff {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: RescheduleBookingAsStaffInput,
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
            rescheduleWithPolicy(this.deps, parts, {
              tenantId: actor.tenantId,
              start: input.start,
              actor: 'staff',
            }).map((moved) => ({
              moved,
              serviceName: parts.service.name,
              serviceId: parts.service.id,
            })),
          )
          .map(({ moved, serviceName }) => {
            audit.record({
              type: 'booking.rescheduled',
              tenantId: actor.tenantId,
              websiteId: moved.websiteId,
              bookingId: moved.id,
              by: 'staff',
            });
            return toCalendarBookingView(moved, serviceName);
          }),
    );
  }
}
