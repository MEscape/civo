import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { bookingConflict, tooManyActiveHolds } from '../../domain/errors/booking-errors';
import { bookingSessionKey } from '../../domain/models/booking';
import { evaluateSlot } from '../../domain/scheduling/slot-assessment';
import { localDateOf } from '../../domain/time/time-zone';
import { HOLD_MINUTES, MAX_LIVE_HOLDS_PER_WEBSITE } from '../booking-limits';
import { toHoldView } from '../booking-view-mappers';
import { loadBookableContext } from '../services/bookable-context';
import { resolvePublicScope } from '../services/public-scope';
import { parseParticipants, parseStart } from '../services/request-parsing';
import { loadSchedulingIndex } from '../services/scheduling-context';

import type { NewBooking } from '../../domain/ports/booking.repository';
import type { BookingFlowDependencies } from '../booking-dependencies';
import type { HoldSlotInput } from '../contracts/booking-inputs';
import type { HoldView } from '../contracts/booking-views';
import type { BookableContextError } from '../services/bookable-context';
import type { PublicScopeError } from '../services/public-scope';

const MS_PER_MINUTE = 60_000;

/**
 * Reserves a slot for a visitor who is about to fill in the booking form. The
 * slot is assessed by the scheduling engine and then held in a single atomic
 * write: if two visitors reach for the same time, one gets the hold and the
 * other a conflict (with alternatives to offer). The hold expires by itself.
 *
 * @authorization public Anyone may start a booking; abuse is bounded by the cap on live holds and by short expiry.
 */
export class HoldSlot {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(
    input: HoldSlotInput,
  ): AppResultAsync<
    HoldView,
    PublicScopeError | BookableContextError | ConflictAppError | InfrastructureAppError
  > {
    const { bookings, references, audit, clock } = this.deps;
    const now = clock.now();

    return resolvePublicScope(this.deps, input.websiteId).andThen((scope) =>
      loadBookableContext(this.deps, scope, input.serviceId, input.locationId).andThen(
        ({ service, location }) =>
          parseStart(input.start)
            .andThen((start) =>
              parseParticipants(service, input.participants).map((participants) => ({
                start,
                participants,
              })),
            )
            .asyncAndThen(({ start, participants }) => {
              const day = localDateOf(start, location.timeZone);
              return bookings
                .countLiveHolds(scope.websiteId, scope.tenantId, now)
                .andThen((holds) =>
                  holds >= MAX_LIVE_HOLDS_PER_WEBSITE
                    ? errAsync(tooManyActiveHolds())
                    : loadSchedulingIndex(this.deps, {
                        tenantId: scope.tenantId,
                        service,
                        location,
                        range: { from: day, to: day },
                        now,
                      }),
                )
                .andThen((index) =>
                  evaluateSlot(index, start, participants).asyncAndThen((slot) => {
                    const reference = references.next();
                    const held: NewBooking = {
                      tenantId: scope.tenantId,
                      websiteId: scope.websiteId,
                      serviceId: service.id,
                      locationId: location.id,
                      reference,
                      status: 'held',
                      start: new Date(slot.start),
                      end: new Date(slot.end),
                      occupiedStart: new Date(slot.occupied.start),
                      occupiedEnd: new Date(slot.occupied.end),
                      participants,
                      resourceIds: slot.resourceIds,
                      sessionKey: bookingSessionKey(slot.sharedSessionKey, reference),
                      sessionCapacity: slot.sessionCapacity,
                      customer: null,
                      holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * MS_PER_MINUTE),
                      rescheduleCount: 0,
                      cancelledAt: null,
                      cancelledBy: null,
                    };
                    return bookings.create(held, now);
                  }),
                )
                .map((booking) => {
                  audit.record({
                    type: 'booking.held',
                    tenantId: scope.tenantId,
                    websiteId: scope.websiteId,
                    bookingId: booking.id,
                    serviceId: service.id,
                  });
                  return toHoldView(booking, service, location);
                })
                .mapErr((error) => {
                  if (error.code === bookingConflict().code) {
                    audit.record({
                      type: 'booking.conflict_detected',
                      tenantId: scope.tenantId,
                      websiteId: scope.websiteId,
                      serviceId: service.id,
                      stage: 'hold',
                    });
                  }
                  return error;
                });
            }),
      ),
    );
  }
}
