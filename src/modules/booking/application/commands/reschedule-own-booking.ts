import type { AppResultAsync } from '@lib/result';

import { toBookingView } from '../booking-view-mappers';
import { rescheduleWithPolicy } from '../services/booking-changes';
import { loadOwnBooking } from '../services/own-booking';
import { resolvePublicScope } from '../services/public-scope';

import type { BookingFlowDependencies } from '../booking-dependencies';
import type { RescheduleOwnBookingInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { BookingChangeError } from '../services/booking-changes';
import type { OwnBookingError } from '../services/own-booking';
import type { PublicScopeError } from '../services/public-scope';

/**
 * A visitor moves their own booking to another time, subject to the
 * service's rescheduling policy. The new time is assessed exactly like a new
 * booking (the booking does not block its own new time) and swapped in one
 * atomic write, so the old time is never released unless the new one is
 * held.
 *
 * @authorization public The caller proves ownership with the booking reference and the e-mail address used to book.
 */
export class RescheduleOwnBooking {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(
    input: RescheduleOwnBookingInput,
  ): AppResultAsync<BookingView, PublicScopeError | OwnBookingError | BookingChangeError> {
    const { audit, clock } = this.deps;

    return resolvePublicScope(this.deps, input.websiteId).andThen((scope) =>
      loadOwnBooking(this.deps, scope, input).andThen((parts) =>
        rescheduleWithPolicy(this.deps, parts, {
          tenantId: scope.tenantId,
          start: input.start,
          actor: 'customer',
        })
          .map((moved) => {
            audit.record({
              type: 'booking.rescheduled',
              tenantId: scope.tenantId,
              websiteId: scope.websiteId,
              bookingId: moved.id,
              by: 'customer',
            });
            return toBookingView({ ...parts, booking: moved }, clock.now());
          })
          .mapErr((error) => {
            if (error.code === 'booking.conflict') {
              audit.record({
                type: 'booking.conflict_detected',
                tenantId: scope.tenantId,
                websiteId: scope.websiteId,
                serviceId: parts.service.id,
                stage: 'reschedule',
              });
            }
            return error;
          }),
      ),
    );
  }
}
