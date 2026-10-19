import type { AppResultAsync } from '@lib/result';

import { toBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { cancelWithPolicy } from '../services/booking-changes';
import { resolveScopeWithinBudget } from '../services/limit-visitor';
import { loadOwnBooking } from '../services/own-booking';

import type { BookingFlowDependencies } from '../booking-dependencies';
import type { BookingAccessInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { BookingChangeError } from '../services/booking-changes';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { OwnBookingError } from '../services/own-booking';
import type { PublicScopeError } from '../services/public-scope';

/**
 * A visitor cancels their own booking, if the service's policy allows it
 * and the deadline has not passed. They prove it is theirs with the
 * reference AND the e-mail address; a wrong pair looks like an unknown
 * booking.
 *
 * @authorization public The caller proves ownership with the booking reference and the e-mail address used to book.
 */
export class CancelOwnBooking {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(
    input: BookingAccessInput,
  ): AppResultAsync<
    BookingView,
    PublicScopeError | VisitorLimitError | OwnBookingError | BookingChangeError
  > {
    const { audit, clock } = this.deps;

    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.changeClient,
      input.websiteId,
    ).andThen((scope) =>
      loadOwnBooking(this.deps, scope, input).andThen((parts) =>
        cancelWithPolicy(this.deps, parts, 'customer').map((cancelled) => {
          audit.record({
            type: 'booking.cancelled',
            tenantId: scope.tenantId,
            websiteId: scope.websiteId,
            bookingId: cancelled.id,
            by: 'customer',
          });
          return toBookingView({ ...parts, booking: cancelled }, clock.now());
        }),
      ),
    );
  }
}
