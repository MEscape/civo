import type { AppResultAsync } from '@lib/result';

import { toBookingView } from '../booking-view-mappers';
import { cancelWithPolicy } from '../services/booking-changes';
import { loadOwnBooking } from '../services/own-booking';
import { resolvePublicScope } from '../services/public-scope';

import type { BookingFlowDependencies } from '../booking-dependencies';
import type { BookingAccessInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { BookingChangeError } from '../services/booking-changes';
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
  ): AppResultAsync<BookingView, PublicScopeError | OwnBookingError | BookingChangeError> {
    const { audit, clock } = this.deps;

    return resolvePublicScope(this.deps, input.websiteId).andThen((scope) =>
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
