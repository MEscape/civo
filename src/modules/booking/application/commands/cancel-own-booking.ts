import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { cancelBooking } from '../../domain/lifecycle/booking-lifecycle';
import { toPublicBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { announce } from '../services/announce';
import { currentInstant } from '../services/clock-instant';
import { findOwnBooking } from '../services/find-own-booking';
import { resolveScopeWithinBudget } from '../services/limit-visitor';
import { recordLostRace, saveChange } from '../services/persist-change';
import { retryOnStale } from '../services/retry-on-stale';

import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingFlowDependencies } from '../booking-dependencies';
import type { PublicBookingKey } from '../contracts/booking-inputs';
import type { PublicBookingView } from '../contracts/booking-views';
import type { FindOwnBookingError } from '../services/find-own-booking';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { PublicScopeError } from '../services/public-scope';

export type CancelOwnBookingError =
  | PublicScopeError
  | VisitorLimitError
  | FindOwnBookingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * A visitor cancels their own booking, found by its reference and address. The service's policy
 * decides whether and until when a customer may (the domain's `cancelBooking`, deadline included).
 * Safe to repeat: a booking that is already cancelled answers as it is, without a second mail.
 *
 * @authorization public A visitor has no account; the reference together with the booking's address is what proves the booking is theirs.
 */
export class CancelOwnBooking {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(input: PublicBookingKey): AppResultAsync<PublicBookingView, CancelOwnBookingError> {
    const now = currentInstant(this.deps.clock);

    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.changeClient,
      input.websiteId,
    ).andThen((scope) =>
      retryOnStale(() =>
        findOwnBooking(this.deps, scope, input).andThen(({ stored, service, location }) => {
          if (stored.booking.status === 'cancelled') {
            return okAsync(
              toPublicBookingView(stored, { service, location, now }, scope.websiteId),
            );
          }
          return cancelBooking({ booking: stored.booking, service, actor: 'customer', now })
            .asyncAndThen((cancelled) =>
              saveChange(this.deps, { scope, before: stored, next: cancelled, now }),
            )
            .mapErr(recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'cancel' }))
            .map((saved) => {
              this.deps.audit.record({
                type: 'booking.cancelled',
                tenantId: scope.tenantId,
                websiteId: scope.websiteId,
                bookingId: saved.booking.id,
                serviceId: service.id,
                by: 'customer',
              });
              announce(this.deps, {
                kind: 'cancelled',
                stored: saved,
                location,
                websiteId: scope.websiteId,
              });
              return toPublicBookingView(saved, { service, location, now }, scope.websiteId);
            });
        }),
      ),
    );
  }
}
