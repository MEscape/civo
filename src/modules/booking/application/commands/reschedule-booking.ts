import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../../domain/errors/booking-errors';
import { rescheduleBooking } from '../../domain/lifecycle/booking-lifecycle';
import { assessSlot } from '../../domain/scheduling/slot-engine';
import { createLocalDateRange } from '../../domain/time/local-date-range';
import { localDateOf } from '../../domain/time/time-zone';
import { toBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { announce } from '../services/announce';
import { currentInstant } from '../services/clock-instant';
import { findBooking } from '../services/find-booking';
import { withinActorLimit } from '../services/limit-actor';
import { recordLostRace, saveChange } from '../services/persist-change';
import { parseStart } from '../services/request-parsing';
import { retryOnLostRace } from '../services/retry-on-stale';
import { loadScheduling } from '../services/scheduling-context';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { RescheduleBookingInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';
import type { ActorLimitError } from '../services/limit-actor';
import type { SchedulingError } from '../services/scheduling-context';

export type RescheduleBookingError =
  | BookingAccessError
  | ActorLimitError
  | FindBookingError
  | ValidationAppError
  | SchedulingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * A manager moves a booking to another start. The new start is judged by the scheduling engine on
 * the current hours and bookings, the booking itself not blocking its new time, and without the
 * notice and horizon a customer is bound by. The domain's `rescheduleBooking` applies the service's
 * policy and decides who serves the new time: the engine's choice for a service assigned at booking
 * time, an open unit for one assigned later (the old assignee was approved for the old time).
 */
export class RescheduleBooking {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: RescheduleBookingInput): AppResultAsync<BookingView, RescheduleBookingError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.manage', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) =>
        parseStart(input.start).asyncAndThen((start) =>
          retryOnLostRace(() =>
            findBooking(this.deps, actor, input.bookingId).andThen(
              ({ scope, stored, service, location }) => {
                const day = localDateOf(start, location.zone);
                const range = createLocalDateRange(day, day, 1);
                if (range === null) {
                  return errAsync(
                    bookingConflict(CODES.slotUnavailable, 'The time is not available.'),
                  );
                }
                return loadScheduling(this.deps, {
                  scope,
                  service,
                  location,
                  range,
                  now,
                  startRules: 'staff',
                  ignoreBookingId: stored.booking.id,
                })
                  .andThen((scheduling) => {
                    const assessment = assessSlot(scheduling, start);
                    return assessment.kind === 'rejected'
                      ? errAsync(
                          bookingConflict(CODES.slotUnavailable, 'The time is not available.'),
                        )
                      : rescheduleBooking({
                          booking: stored.booking,
                          service,
                          slot: assessment.slot,
                          actor: 'manager',
                          now,
                        }).asyncAndThen((moved) =>
                          saveChange(this.deps, { scope, before: stored, next: moved, now }),
                        );
                  })
                  .mapErr(
                    recordLostRace(this.deps, {
                      scope,
                      serviceId: service.id,
                      stage: 'reschedule',
                    }),
                  )
                  .map((saved) => {
                    this.deps.audit.record({
                      type: 'booking.rescheduled',
                      tenantId: scope.tenantId,
                      websiteId: scope.websiteId,
                      actorId: actor.id,
                      bookingId: saved.booking.id,
                      serviceId: service.id,
                      by: 'manager',
                    });
                    announce(this.deps, {
                      kind: 'rescheduled',
                      stored: saved,
                      location,
                      websiteId: scope.websiteId,
                    });
                    return toBookingView(saved, location.zone, scope.websiteId);
                  });
              },
            ),
          ),
        ),
      );
  }
}
