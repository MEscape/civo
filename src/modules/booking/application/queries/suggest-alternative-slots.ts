import type { AppResultAsync } from '@lib/result';

import {
  alternativeRange,
  suggestAlternativeSlots,
} from '../../domain/scheduling/alternative-slots';
import {
  ALTERNATIVE_SEARCH_DAYS,
  DEFAULT_ALTERNATIVE_COUNT,
  MAX_ALTERNATIVE_COUNT,
} from '../booking-limits';
import { toSlotView } from '../booking-view-mappers';
import { loadBookableContext } from '../services/bookable-context';
import { resolvePublicScope } from '../services/public-scope';
import { parseParticipants, parseStart } from '../services/request-parsing';
import { loadSchedulingIndex } from '../services/scheduling-context';

import type { PublicBookingDependencies } from '../booking-dependencies';
import type { SuggestAlternativeSlotsInput } from '../contracts/booking-inputs';
import type { AlternativeSlotsView } from '../contracts/booking-views';
import type { BookableContextError } from '../services/bookable-context';
import type { PublicScopeError } from '../services/public-scope';

/**
 * Other times worth offering when the one a visitor wanted is gone: nearest
 * first, the same day before other days, and always the same answer for the
 * same bookings (the ranking has no ties).
 *
 * @authorization public Lists free times only, like the availability query it complements.
 */
export class SuggestAlternativeSlots {
  constructor(private readonly deps: PublicBookingDependencies) {}

  execute(
    input: SuggestAlternativeSlotsInput,
  ): AppResultAsync<AlternativeSlotsView, PublicScopeError | BookableContextError> {
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
            .asyncAndThen(({ start, participants }) =>
              loadSchedulingIndex(this.deps, {
                tenantId: scope.tenantId,
                service,
                location,
                range: alternativeRange(start, location.timeZone, ALTERNATIVE_SEARCH_DAYS),
                now: this.deps.clock.now(),
              }).map((index) => ({
                timeZone: location.timeZone,
                slots: suggestAlternativeSlots(
                  index,
                  start,
                  participants,
                  Math.min(input.count ?? DEFAULT_ALTERNATIVE_COUNT, MAX_ALTERNATIVE_COUNT),
                ).map(toSlotView),
              })),
            ),
      ),
    );
  }
}
