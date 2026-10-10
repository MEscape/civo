import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { cancelBooking } from '../../domain/lifecycle/booking-lifecycle';
import { parseBookingId } from '../../domain/models/ids';
import { resolvePublicScope } from '../services/public-scope';

import type { BookingFlowDependencies } from '../booking-dependencies';
import type { ReleaseHoldInput } from '../contracts/booking-inputs';
import type { PublicScopeError } from '../services/public-scope';

export interface ReleaseHoldResult {
  /** `false` when there was nothing to release (already expired, confirmed or unknown). */
  readonly released: boolean;
}

/**
 * Gives a held slot back when the visitor leaves the flow, so others can
 * have it at once instead of after the expiry. Idempotent and quiet about
 * what it does not find: releasing a hold that is gone succeeds.
 *
 * @authorization public The hold id is an unguessable capability issued to the visitor who made the hold.
 */
export class ReleaseHold {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(
    input: ReleaseHoldInput,
  ): AppResultAsync<
    ReleaseHoldResult,
    PublicScopeError | ConflictAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { bookings, audit, clock } = this.deps;
    const now = clock.now();

    return resolvePublicScope(this.deps, input.websiteId).andThen((scope) =>
      parseBookingId(input.holdId)
        .asyncAndThen((id) => bookings.findById(id, scope.tenantId))
        .andThen((hold) => {
          if (hold?.websiteId !== scope.websiteId || hold.status !== 'held') {
            return okAsync<ReleaseHoldResult>({ released: false });
          }
          const released = cancelBooking(hold, 'customer', now);
          if (released.isErr()) {
            return errAsync(released.error);
          }
          return bookings.save(released.value, hold, now).map(() => {
            audit.record({
              type: 'booking.hold_released',
              tenantId: scope.tenantId,
              websiteId: scope.websiteId,
              bookingId: hold.id,
            });
            return { released: true };
          });
        }),
    );
  }
}
