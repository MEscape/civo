import type { ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { findSlots } from '../../domain/scheduling/slot-engine';
import { MAX_AVAILABILITY_RANGE_DAYS, MAX_SLOTS_PER_QUERY } from '../booking-limits';
import { toSlotView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { findOwnBooking } from '../services/find-own-booking';
import { resolveScopeWithinBudget } from '../services/limit-visitor';
import { loadOwnBookingScheduling } from '../services/own-booking-scheduling';
import { parseDateRange } from '../services/request-parsing';

import type { BookingFlowDependencies } from '../booking-dependencies';
import type { GetOwnBookingSlotsInput } from '../contracts/booking-inputs';
import type { AvailableSlotsView } from '../contracts/booking-views';
import type { FindOwnBookingError } from '../services/find-own-booking';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { PublicScopeError } from '../services/public-scope';
import type { SchedulingError } from '../services/scheduling-context';

export type GetOwnBookingSlotsError =
  PublicScopeError | VisitorLimitError | FindOwnBookingError | ValidationAppError | SchedulingError;

/**
 * The starts a visitor can move their own booking to over a span of days, earliest first: the same
 * question the move itself asks (`loadOwnBookingScheduling`), so the booking does not hide its own
 * time, a service no longer offered online can still be moved, and every time offered is accepted.
 * The booking is reached by reference and address, with the lookup's budget, so the answer says
 * nothing to someone who does not hold both.
 *
 * @authorization public A visitor has no account; the reference together with the booking's address is what proves the booking is theirs.
 */
export class GetOwnBookingSlots {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(
    input: GetOwnBookingSlotsInput,
  ): AppResultAsync<AvailableSlotsView, GetOwnBookingSlotsError> {
    const now = currentInstant(this.deps.clock);

    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.lookupClient,
      input.websiteId,
    ).andThen((scope) =>
      findOwnBooking(this.deps, scope, input).andThen((own) =>
        parseDateRange(input, MAX_AVAILABILITY_RANGE_DAYS)
          .asyncAndThen((range) => loadOwnBookingScheduling(this.deps, { scope, own, range, now }))
          .map((scheduling): AvailableSlotsView => {
            const zone = own.location.zone;
            const slots = findSlots(scheduling);
            return {
              timeZone: zone,
              slots: slots
                .slice(0, MAX_SLOTS_PER_QUERY)
                .map((slot) => toSlotView({ start: slot.start, end: slot.end }, zone)),
              isTruncated: slots.length > MAX_SLOTS_PER_QUERY,
            };
          }),
      ),
    );
  }
}
