import type { AppResultAsync } from '@lib/result';

import { toPublicBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { findOwnBooking } from '../services/find-own-booking';
import { resolveScopeWithinBudget } from '../services/limit-visitor';

import type { BookingFlowDependencies } from '../booking-dependencies';
import type { PublicBookingKey } from '../contracts/booking-inputs';
import type { PublicBookingView } from '../contracts/booking-views';
import type { FindOwnBookingError } from '../services/find-own-booking';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { PublicScopeError } from '../services/public-scope';

export type GetPublicBookingError = PublicScopeError | VisitorLimitError | FindOwnBookingError;

/**
 * A visitor's own booking, found by its reference and the address it was made with. Every other
 * case, a wrong reference, another website, a wrong address, answers "not found", and the number of
 * lookups per address is limited, so references cannot be probed.
 *
 * @authorization public A visitor has no account; possession of the reference and the booking's address is what stands for "my booking".
 */
export class GetPublicBooking {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(input: PublicBookingKey): AppResultAsync<PublicBookingView, GetPublicBookingError> {
    const now = currentInstant(this.deps.clock);
    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.lookupClient,
      input.websiteId,
    ).andThen((scope) =>
      findOwnBooking(this.deps, scope, input).map(({ stored, service, location }) =>
        toPublicBookingView(stored, { service, location, now }, scope.websiteId),
      ),
    );
  }
}
