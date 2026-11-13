import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../../domain/errors/booking-errors';
import { cancelBooking } from '../../domain/lifecycle/booking-lifecycle';
import { parseBookingId } from '../../domain/models/ids';
import { toPublicBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { requireBooking, withContext } from '../services/booking-context';
import { currentInstant } from '../services/clock-instant';
import { resolveScopeWithinBudget } from '../services/limit-visitor';
import { recordLostRace, saveChange } from '../services/persist-change';
import { retryOnStale } from '../services/retry-on-stale';

import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingFlowDependencies } from '../booking-dependencies';
import type { ReleaseHoldInput } from '../contracts/booking-inputs';
import type { PublicBookingView } from '../contracts/booking-views';
import type { BookingContextError } from '../services/booking-context';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { PublicScopeError } from '../services/public-scope';

export type ReleaseHoldError =
  | PublicScopeError
  | VisitorLimitError
  | BookingContextError
  | ValidationAppError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * Gives a hold back so that its slot is free for the next visitor at once instead of when it runs
 * out. Only a hold can be released this way: a confirmed booking belongs to whoever made it and is
 * cancelled with its reference and address, not with an id. Safe to repeat: a hold that is already
 * released answers as it is.
 *
 * @authorization public The hold's id is the visitor's capability; releasing it only frees a reservation nobody has paid for or confirmed.
 */
export class ReleaseHold {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(input: ReleaseHoldInput): AppResultAsync<PublicBookingView, ReleaseHoldError> {
    const now = currentInstant(this.deps.clock);

    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.changeClient,
      input.websiteId,
    ).andThen((scope) =>
      parseBookingId(input.bookingId).asyncAndThen((id) =>
        retryOnStale(() =>
          requireBooking(this.deps, scope, id)
            .andThen((stored) => withContext(this.deps, scope, stored))
            .andThen(({ stored, service, location }) => {
              const { booking } = stored;
              const view = (next: typeof stored) =>
                toPublicBookingView(next, { service, location, now }, scope.websiteId);
              if (booking.status === 'cancelled' || booking.status === 'expired') {
                return okAsync(view(stored));
              }
              if (booking.status !== 'held') {
                return errAsync(
                  bookingConflict(
                    CODES.invalidStateTransition,
                    'Only a reservation can be released.',
                  ),
                );
              }
              return cancelBooking({ booking, service, actor: 'customer', now })
                .asyncAndThen((cancelled) =>
                  saveChange(this.deps, { scope, before: stored, next: cancelled, now }),
                )
                .mapErr(
                  recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'cancel' }),
                )
                .map((saved) => {
                  this.deps.audit.record({
                    type: 'booking.hold_released',
                    tenantId: scope.tenantId,
                    websiteId: scope.websiteId,
                    bookingId: saved.booking.id,
                    serviceId: service.id,
                  });
                  return view(saved);
                });
            }),
        ),
      ),
    );
  }
}
