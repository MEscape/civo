import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../../domain/errors/booking-errors';
import { rescheduleBooking } from '../../domain/lifecycle/booking-lifecycle';
import { assessSlot } from '../../domain/scheduling/slot-engine';
import { createLocalDateRange } from '../../domain/time/local-date-range';
import { localDateOf } from '../../domain/time/time-zone';
import { toPublicBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { announce } from '../services/announce';
import { currentInstant } from '../services/clock-instant';
import { findOwnBooking } from '../services/find-own-booking';
import { resolveScopeWithinBudget } from '../services/limit-visitor';
import { loadOwnBookingScheduling } from '../services/own-booking-scheduling';
import { recordLostRace, saveChange } from '../services/persist-change';
import { parseStart } from '../services/request-parsing';
import { retryOnLostRace } from '../services/retry-on-stale';

import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingFlowDependencies } from '../booking-dependencies';
import type { RescheduleOwnBookingInput } from '../contracts/booking-inputs';
import type { PublicBookingView } from '../contracts/booking-views';
import type { FindOwnBookingError } from '../services/find-own-booking';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { PublicScopeError } from '../services/public-scope';
import type { SchedulingError } from '../services/scheduling-context';

export type RescheduleOwnBookingError =
  | PublicScopeError
  | VisitorLimitError
  | FindOwnBookingError
  | ValidationAppError
  | SchedulingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * A visitor moves their own booking to another start. The new start is judged by the scheduling
 * engine on the current hours and bookings, with the booking itself not blocking its new time; the
 * domain's `rescheduleBooking` applies the service's policy (allowed, deadline, how often) and the
 * write is refused if the booking or the new time was taken meanwhile. The old time is freed in the
 * same write that takes the new one.
 *
 * @authorization public A visitor has no account; the reference together with the booking's address is what proves the booking is theirs.
 */
export class RescheduleOwnBooking {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(
    input: RescheduleOwnBookingInput,
  ): AppResultAsync<PublicBookingView, RescheduleOwnBookingError> {
    const now = currentInstant(this.deps.clock);

    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.changeClient,
      input.websiteId,
    ).andThen((scope) =>
      parseStart(input.start).asyncAndThen((start) =>
        retryOnLostRace(() =>
          findOwnBooking(this.deps, scope, input).andThen((own) => {
            const { stored, service, location } = own;
            const day = localDateOf(start, location.zone);
            const range = createLocalDateRange(day, day, 1);
            if (range === null) {
              return errAsync(bookingConflict(CODES.slotUnavailable, 'The time is not available.'));
            }
            return loadOwnBookingScheduling(this.deps, { scope, own, range, now })
              .andThen((scheduling) => {
                const assessment = assessSlot(scheduling, start);
                return assessment.kind === 'rejected'
                  ? errAsync(bookingConflict(CODES.slotUnavailable, 'The time is not available.'))
                  : rescheduleBooking({
                      booking: stored.booking,
                      service,
                      slot: assessment.slot,
                      actor: 'customer',
                      now,
                    }).asyncAndThen((moved) =>
                      saveChange(this.deps, { scope, before: stored, next: moved, now }),
                    );
              })
              .mapErr(
                recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'reschedule' }),
              )
              .map((saved) => {
                this.deps.audit.record({
                  type: 'booking.rescheduled',
                  tenantId: scope.tenantId,
                  websiteId: scope.websiteId,
                  bookingId: saved.booking.id,
                  serviceId: service.id,
                  by: 'customer',
                });
                announce(this.deps, {
                  kind: 'rescheduled',
                  stored: saved,
                  location,
                  websiteId: scope.websiteId,
                });
                return toPublicBookingView(saved, { service, location, now }, scope.websiteId);
              });
          }),
        ),
      ),
    );
  }
}
