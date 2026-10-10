import type { AppResultAsync } from '@lib/result';

import { parseLocalDateRange } from '../../domain/scheduling/local-date-range';
import { findAvailableSlots } from '../../domain/scheduling/slot-finder';
import { MAX_AVAILABILITY_RANGE_DAYS } from '../booking-limits';
import { toAvailabilityView } from '../booking-view-mappers';
import { loadBookableContext } from '../services/bookable-context';
import { resolvePublicScope } from '../services/public-scope';
import { parseParticipants } from '../services/request-parsing';
import { loadSchedulingIndex } from '../services/scheduling-context';

import type { PublicBookingDependencies } from '../booking-dependencies';
import type { GetAvailableSlotsInput } from '../contracts/booking-inputs';
import type { AvailabilityView } from '../contracts/booking-views';
import type { BookableContextError } from '../services/bookable-context';
import type { PublicScopeError } from '../services/public-scope';

/**
 * The bookable start times of a service at a location over a span of days.
 * Never cached: availability changes with every booking, and a stale list is
 * a promise the engine then has to break.
 *
 * @authorization public Lists free times only: no resource, no customer and no booking detail leaves this query.
 */
export class GetAvailableSlots {
  constructor(private readonly deps: PublicBookingDependencies) {}

  execute(
    input: GetAvailableSlotsInput,
  ): AppResultAsync<AvailabilityView, PublicScopeError | BookableContextError> {
    return resolvePublicScope(this.deps, input.websiteId).andThen((scope) =>
      loadBookableContext(this.deps, scope, input.serviceId, input.locationId).andThen(
        ({ service, location }) => {
          const parsed = parseLocalDateRange(
            input.from,
            input.to,
            MAX_AVAILABILITY_RANGE_DAYS,
          ).andThen((range) =>
            parseParticipants(service, input.participants).map((participants) => ({
              range,
              participants,
            })),
          );
          return parsed.asyncAndThen(({ range, participants }) =>
            loadSchedulingIndex(this.deps, {
              tenantId: scope.tenantId,
              service,
              location,
              range,
              now: this.deps.clock.now(),
            }).map((index) =>
              toAvailabilityView(
                location,
                service,
                { from: input.from, to: input.to },
                findAvailableSlots(index, participants),
              ),
            ),
          );
        },
      ),
    );
  }
}
