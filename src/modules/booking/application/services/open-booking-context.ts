import type { InfrastructureAppError } from '@lib/errors';
import { combineAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_MINUTE, isDefined, keyBy, unique } from '@lib/utils';

import { scheduleTooLarge } from '../../domain/errors/booking-errors';
import { isBlocking } from '../../domain/models/booking';
import { SLOT_RULE_LIMITS } from '../../domain/scheduling/slot-rules';
import { asInstant } from '../../domain/time/instant';
import { MAX_BLOCKING_BOOKINGS_PER_QUERY } from '../booking-limits';

import type { BookableService } from '../../domain/models/bookable-service';
import type { Booking } from '../../domain/models/booking';
import type { BookableResourceId, BookableServiceId } from '../../domain/models/ids';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { BookingDependencies } from '../booking-dependencies';

/** The services the open bookings are of, each read once. */
export function servicesOfBookings(
  deps: Pick<BookingDependencies, 'services'>,
  scope: BookingScope,
  open: readonly StoredBooking[],
): AppResultAsync<ReadonlyMap<BookableServiceId, BookableService>, InfrastructureAppError> {
  const ids = unique(open.map(({ booking }) => booking.serviceId));
  return combineAsync(ids.map((id) => deps.services.findById(scope, id))).map((found) =>
    keyBy(found.filter(isDefined), (service) => service.id),
  );
}

/** The bookings that hold the employee around the open ones: what their calendar is made of. */
export function blockingAround(
  deps: Pick<BookingDependencies, 'bookings'>,
  around: {
    readonly scope: BookingScope;
    readonly own: BookableResourceId;
    readonly open: readonly StoredBooking[];
    readonly now: Instant;
  },
): AppResultAsync<
  readonly Booking[],
  InfrastructureAppError | ReturnType<typeof scheduleTooLarge>
> {
  const { scope, own, open, now } = around;
  const slack = SLOT_RULE_LIMITS.bufferMax * MS_PER_MINUTE;
  const span = {
    start: asInstant(Math.min(...open.map(({ booking }) => booking.occupied.start)) - slack),
    end: asInstant(Math.max(...open.map(({ booking }) => booking.occupied.end)) + slack),
  };
  return deps.bookings
    .listBlocking(scope, { span, now, resourceIds: [own], limit: MAX_BLOCKING_BOOKINGS_PER_QUERY })
    .andThen(({ bookings, isComplete }) =>
      isComplete ? okAsync(bookings) : errAsync(scheduleTooLarge()),
    )
    .map((stored) =>
      stored.map(({ booking }) => booking).filter((booking) => isBlocking(booking, now)),
    );
}
