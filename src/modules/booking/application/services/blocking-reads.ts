import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_MINUTE } from '@lib/utils';

import { scheduleTooLarge } from '../../domain/errors/booking-errors';
import { isBlocking } from '../../domain/models/booking';
import { SLOT_RULE_LIMITS } from '../../domain/scheduling/slot-rules';
import { asInstant } from '../../domain/time/instant';
import { addLocalDays } from '../../domain/time/local-date';
import { startOfLocalDay } from '../../domain/time/local-time-resolution';
import { MAX_BLOCKING_BOOKINGS_PER_QUERY, MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';

import type { BookableResource, ResourceKind } from '../../domain/models/bookable-resource';
import type { Booking } from '../../domain/models/booking';
import type { BookableResourceId } from '../../domain/models/ids';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { LocalDateRange } from '../../domain/time/local-date-range';
import type { TimeInterval } from '../../domain/time/time-interval';
import type { BookingDependencies, BookingFlowDependencies } from '../booking-dependencies';

type Reads = Pick<BookingDependencies | BookingFlowDependencies, 'bookings' | 'resources'>;

/** A read too large to answer from (refused, never cut), or storage that failed. */
type BlockingReadError = InfrastructureAppError | ConflictAppError;

/** The span in which a booking could occupy a resource that matters for `window`, buffers included. */
function spanAround(window: LocalDateRange, location: BookingLocationFacts): TimeInterval {
  const slack = SLOT_RULE_LIMITS.bufferMax * MS_PER_MINUTE;
  return {
    start: asInstant(startOfLocalDay(window.from, location.zone) - slack),
    end: asInstant(startOfLocalDay(addLocalDays(window.to, 1), location.zone) + slack),
  };
}

/**
 * The resources of `types` that can serve the location: its own and those that serve every
 * location (a resource belongs to one location, EX-19). More than the bound is refused as too large
 * instead of deciding on a cut list.
 */
export function loadServingResources(
  deps: Pick<Reads, 'resources'>,
  request: {
    readonly scope: BookingScope;
    readonly location: BookingLocationFacts;
    readonly types: readonly ResourceKind[];
  },
): AppResultAsync<readonly BookableResource[], BlockingReadError> {
  const { scope, location, types } = request;
  return deps.resources
    .list(scope, {
      servingLocationId: location.id,
      types,
      // One more than the bound: it tells a full list from a cut one.
      limit: MAX_RESOURCES_PER_WEBSITE + 1,
    })
    .andThen((resources) =>
      resources.length > MAX_RESOURCES_PER_WEBSITE
        ? errAsync(scheduleTooLarge())
        : okAsync(resources),
    );
}

/**
 * The bookings that hold one of `resourceIds` around `window`, other than the ones named: what
 * those resources' calendars are made of. Bookings of other resources are not read, so a busy
 * location does not crowd out a quiet one. A span with more bookings than one answer may be built
 * from is refused as too large instead of being judged on a partial picture.
 */
export function loadBlocking(
  deps: Pick<Reads, 'bookings'>,
  around: {
    readonly scope: BookingScope;
    readonly location: BookingLocationFacts;
    readonly window: LocalDateRange;
    readonly now: Instant;
    readonly resourceIds: readonly BookableResourceId[];
    readonly except: ReadonlyArray<Booking['id']>;
  },
): AppResultAsync<readonly Booking[], BlockingReadError> {
  const { scope, location, window, now, resourceIds, except } = around;
  return deps.bookings
    .listBlocking(scope, {
      span: spanAround(window, location),
      now,
      resourceIds,
      limit: MAX_BLOCKING_BOOKINGS_PER_QUERY,
    })
    .andThen(({ bookings, isComplete }) =>
      isComplete ? okAsync(bookings) : errAsync(scheduleTooLarge()),
    )
    .map((stored) =>
      stored
        .map(({ booking }) => booking)
        .filter((booking) => !except.includes(booking.id) && isBlocking(booking, now)),
    );
}
