import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { tooManyBookings } from '../../domain/errors/booking-errors';
import { confirmBooking } from '../../domain/lifecycle/booking-hold';
import { parseBookingId } from '../../domain/models/ids';
import { normalizeEmail } from '../../domain/policies/customer-access';
import { MAX_LIVE_BOOKINGS_PER_EMAIL } from '../booking-limits';
import { toPublicBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { announce } from '../services/announce';
import { requireBooking, withContext } from '../services/booking-context';
import { currentInstant } from '../services/clock-instant';
import { resolveScopeWithinBudget } from '../services/limit-visitor';
import { recordLostRace, saveChange } from '../services/persist-change';
import { retryOnStale } from '../services/retry-on-stale';

import type { BookingScope, BookingWriteError } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { BookingFlowDependencies } from '../booking-dependencies';
import type { ConfirmBookingInput } from '../contracts/booking-inputs';
import type { PublicBookingView } from '../contracts/booking-views';
import type { BookingContext, BookingContextError } from '../services/booking-context';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { PublicScopeError } from '../services/public-scope';

export type ConfirmBookingError =
  | PublicScopeError
  | VisitorLimitError
  | BookingContextError
  | ValidationAppError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * Turns a hold into a booking once the visitor's details are in. The hold must not have run out and
 * the required details must be present (the domain's `confirmBooking`), an address may carry only a
 * few live bookings, and the write is refused if the hold changed meanwhile. The visitor is told only
 * after the write returned.
 *
 * Safe to repeat: confirming a booking that is already confirmed with the same address returns it
 * unchanged, writes nothing and sends nothing, so a retry after a lost answer is harmless.
 *
 * @authorization public The hold's id is the visitor's capability, handed out by the hold itself; the details they submit become the booking's.
 */
export class ConfirmBooking {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(input: ConfirmBookingInput): AppResultAsync<PublicBookingView, ConfirmBookingError> {
    const { clock } = this.deps;
    const now = currentInstant(clock);

    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.confirmClient,
      input.websiteId,
    ).andThen((scope) =>
      parseBookingId(input.bookingId).asyncAndThen((id) =>
        retryOnStale(() =>
          requireBooking(this.deps, scope, id)
            .andThen((stored) => withContext(this.deps, scope, stored))
            .andThen((context) => this.confirm({ scope, context, input, now })),
        ),
      ),
    );
  }

  private confirm(request: {
    readonly scope: BookingScope;
    readonly context: BookingContext;
    readonly input: ConfirmBookingInput;
    readonly now: Instant;
  }): AppResultAsync<PublicBookingView, ConfirmBookingError> {
    const { scope, context, input, now } = request;
    const { stored, service, location } = context;
    const { booking } = stored;
    const view = (confirmed: typeof stored) =>
      toPublicBookingView(confirmed, { service, location, now }, scope.websiteId);

    const email = normalizeEmail(input.customer.email);
    if (
      booking.status === 'confirmed' &&
      email !== null &&
      email === normalizeEmail(booking.customer?.email)
    ) {
      return okAsync(view(stored));
    }

    return confirmBooking({ booking, service, customer: input.customer, now })
      .asyncAndThen((confirmed) =>
        (email === null
          ? okAsync(0)
          : this.deps.bookings.countLiveByEmail(scope, email, now)
        ).andThen((live) =>
          live >= MAX_LIVE_BOOKINGS_PER_EMAIL
            ? errAsync(tooManyBookings())
            : saveChange(this.deps, { scope, before: stored, next: confirmed, now }),
        ),
      )
      .mapErr(recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'confirm' }))
      .map((saved) => {
        this.deps.audit.record({
          type: 'booking.confirmed',
          tenantId: scope.tenantId,
          websiteId: scope.websiteId,
          bookingId: saved.booking.id,
          serviceId: service.id,
        });
        announce(this.deps, {
          kind: 'confirmed',
          stored: saved,
          location,
          websiteId: scope.websiteId,
        });
        return view(saved);
      });
  }
}
