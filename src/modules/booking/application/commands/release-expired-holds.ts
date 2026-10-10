import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { MAX_RELEASED_HOLDS_PER_RUN } from '../booking-limits';

import type { BookingDependencies } from '../booking-dependencies';
import type { ReleaseExpiredHoldsInput } from '../contracts/booking-inputs';

export interface ReleaseExpiredHoldsResult {
  readonly released: number;
}

/**
 * Housekeeping: marks holds that ran out as expired. Correctness never
 * depends on it (an expired hold stops blocking the moment it expires, and
 * every new booking releases the expired holds it would collide with); it
 * keeps the operations calendar and the stored statuses tidy.
 */
export class ReleaseExpiredHolds {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: ReleaseExpiredHoldsInput,
  ): AppResultAsync<
    ReleaseExpiredHoldsResult,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, bookings, audit, clock } = this.deps;

    return authorization.requireInTenant('booking.manage').andThen((actor) =>
      parseWebsiteId(input.websiteId).asyncAndThen((websiteId) =>
        bookings
          .releaseExpiredHolds(
            { websiteId, tenantId: actor.tenantId },
            clock.now(),
            MAX_RELEASED_HOLDS_PER_RUN,
          )
          .map((released) => {
            if (released > 0) {
              audit.record({
                type: 'booking.holds_expired',
                tenantId: actor.tenantId,
                websiteId,
                count: released,
              });
            }
            return { released };
          }),
      ),
    );
  }
}
