import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES as CODES,
  bookingConflict,
  tooManyHolds,
} from '../../domain/errors/booking-errors';
import { createHold } from '../../domain/lifecycle/booking-hold';
import { privateSessionKey } from '../../domain/models/booking-session';
import { snapshotOf } from '../../domain/models/service-snapshot';
import { assessSlot } from '../../domain/scheduling/slot-engine';
import { createLocalDateRange } from '../../domain/time/local-date-range';
import { localDateOf } from '../../domain/time/time-zone';
import { MAX_LIVE_HOLDS_PER_WEBSITE } from '../booking-limits';
import { toPublicBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { HOLD_DURATION } from '../services/hold-duration';
import { resolveScopeWithinBudget } from '../services/limit-visitor';
import { loadBookable } from '../services/load-bookable';
import { recordLostRace } from '../services/persist-change';
import { parseStart } from '../services/request-parsing';
import { retryOnLostRace } from '../services/retry-on-stale';
import { loadScheduling } from '../services/scheduling-context';

import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingFlowDependencies } from '../booking-dependencies';
import type { HoldSlotInput } from '../contracts/booking-inputs';
import type { PublicBookingView } from '../contracts/booking-views';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { BookableContextError } from '../services/load-bookable';
import type { PublicScopeError } from '../services/public-scope';
import type { SchedulingError } from '../services/scheduling-context';

/** The visitor's language as the booking keeps it: two lower-case letters, or nothing. */
const localeOf = ({ locale }: HoldSlotInput) =>
  locale !== undefined && /^[a-z]{2}$/.test(locale) ? { locale } : {};

export type HoldSlotError =
  | PublicScopeError
  | VisitorLimitError
  | BookableContextError
  | ValidationAppError
  | SchedulingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * Reserves a slot for a visitor who is about to fill in the booking form. The start is judged by the
 * scheduling engine on the current hours and bookings, then held in one atomic write: if two visitors
 * reach for the same time, one gets the hold and the other a conflict. The hold expires by itself, and
 * the number of holds a website carries is capped, so abandoned ones cannot pile up.
 *
 * @authorization public Anyone may start a booking; abuse is bounded by the cap on live holds, the per-address budget and the short expiry.
 */
export class HoldSlot {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(input: HoldSlotInput): AppResultAsync<PublicBookingView, HoldSlotError> {
    const { bookings, identity, audit, clock } = this.deps;
    const now = currentInstant(clock);

    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.holdClient,
      input.websiteId,
    ).andThen((scope) =>
      loadBookable(this.deps, scope, {
        serviceId: input.serviceId,
        locationId: input.locationId,
        channel: 'online',
      }).andThen(({ service, location }) =>
        parseStart(input.start).asyncAndThen((start) => {
          const day = localDateOf(start, location.zone);
          const range = createLocalDateRange(day, day, 1);
          if (range === null) {
            return errAsync(bookingConflict(CODES.slotUnavailable, 'The time is not available.'));
          }
          return retryOnLostRace(() =>
            bookings
              .countLiveHolds(scope, now)
              .andThen((holds) =>
                holds >= MAX_LIVE_HOLDS_PER_WEBSITE
                  ? errAsync(tooManyHolds())
                  : loadScheduling(this.deps, {
                      scope,
                      service,
                      location,
                      range,
                      now,
                      startRules: 'customer',
                    }),
              )
              .andThen((scheduling) => {
                const assessment = assessSlot(scheduling, start);
                if (assessment.kind === 'rejected') {
                  return errAsync(
                    bookingConflict(CODES.slotUnavailable, 'The time is not available.'),
                  );
                }
                const id = identity.nextId();
                return createHold({
                  id,
                  service,
                  locationId: location.id,
                  channel: 'online',
                  slot: assessment.slot,
                  now,
                  holdMinutes: HOLD_DURATION,
                }).asyncAndThen((booking) =>
                  bookings.create(
                    scope,
                    {
                      booking,
                      placement: {
                        reference: identity.nextReference(),
                        participants: 1,
                        sessionKey: privateSessionKey(id),
                        sessionCapacity: 1,
                        snapshot: snapshotOf(service),
                        ...localeOf(input),
                      },
                    },
                    now,
                  ),
                );
              }),
          )
            .mapErr(recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'hold' }))
            .map((stored) => {
              audit.record({
                type: 'booking.held',
                tenantId: scope.tenantId,
                websiteId: scope.websiteId,
                bookingId: stored.booking.id,
                serviceId: service.id,
              });
              return toPublicBookingView(stored, { service, location, now }, scope.websiteId);
            });
        }),
      ),
    );
  }
}
