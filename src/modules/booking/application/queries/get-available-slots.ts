import type { ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { findSlots } from '../../domain/scheduling/slot-engine';
import { MAX_AVAILABILITY_RANGE_DAYS, MAX_SLOTS_PER_QUERY } from '../booking-limits';
import { toSlotView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { resolveScopeWithinBudget } from '../services/limit-visitor';
import { loadBookable } from '../services/load-bookable';
import { parseDateRange } from '../services/request-parsing';
import { loadScheduling } from '../services/scheduling-context';

import type { BookingFlowDependencies } from '../booking-dependencies';
import type { GetAvailableSlotsInput } from '../contracts/booking-inputs';
import type { AvailableSlotsView } from '../contracts/booking-views';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { BookableContextError } from '../services/load-bookable';
import type { PublicScopeError } from '../services/public-scope';
import type { SchedulingError } from '../services/scheduling-context';

export type GetAvailableSlotsError =
  | PublicScopeError
  | VisitorLimitError
  | BookableContextError
  | ValidationAppError
  | SchedulingError;

/**
 * Every start a visitor can book for a service at a location over a span of days, earliest first.
 * The answer is the scheduling engine's, computed from the current hours and bookings with the
 * service's own notice and horizon; it names the location's zone and nothing about who else books.
 *
 * @authorization public Anyone may see when a service can be booked; the answer holds no booking, customer or employee data.
 */
export class GetAvailableSlots {
  constructor(private readonly deps: BookingFlowDependencies) {}

  execute(
    input: GetAvailableSlotsInput,
  ): AppResultAsync<AvailableSlotsView, GetAvailableSlotsError> {
    const now = currentInstant(this.deps.clock);

    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.searchClient,
      input.websiteId,
    ).andThen((scope) =>
      loadBookable(this.deps, scope, {
        serviceId: input.serviceId,
        locationId: input.locationId,
        channel: 'online',
      }).andThen(({ service, location }) =>
        parseDateRange(input, MAX_AVAILABILITY_RANGE_DAYS)
          .asyncAndThen((range) =>
            loadScheduling(this.deps, {
              scope,
              service,
              location,
              range,
              now,
              startRules: 'customer',
            }),
          )
          .map((scheduling): AvailableSlotsView => {
            const slots = findSlots(scheduling);
            return {
              timeZone: location.zone,
              slots: slots
                .slice(0, MAX_SLOTS_PER_QUERY)
                .map((slot) => toSlotView({ start: slot.start, end: slot.end }, location.zone)),
              isTruncated: slots.length > MAX_SLOTS_PER_QUERY,
            };
          }),
      ),
    );
  }
}
