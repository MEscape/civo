import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import { asInstant } from '../../domain/time/instant';
import { formatInstantInZone } from '../../domain/time/instant-format';
import { createInterval } from '../../domain/time/time-interval';
import { FUTURE_BOOKINGS_DAYS, MAX_IMPACT_BOOKINGS } from '../booking-limits';

import type { BookableServiceId, BookingLocationId } from '../../domain/models/ids';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { TimeInterval } from '../../domain/time/time-interval';
import type { TimeZone } from '../../domain/time/time-zone';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { ServiceBookingView } from '../contracts/service-views';

type Reads = Pick<ServiceAdminDependencies, 'bookings'>;

/** The whole stretch "that has not started yet" covers. */
function ahead(now: Instant): TimeInterval | null {
  return createInterval(now, asInstant(now + FUTURE_BOOKINGS_DAYS * MS_PER_DAY));
}

/** Which service, optionally at one location only, and from when. */
export interface ServiceBookingsQuery {
  readonly scope: BookingScope;
  readonly serviceId: BookableServiceId;
  readonly locationId?: BookingLocationId;
  readonly now: Instant;
}

/** Confirmed bookings of a service that have not started yet. */
export function countFutureServiceBookings(
  deps: Reads,
  { scope, serviceId, locationId, now }: ServiceBookingsQuery,
): AppResultAsync<number, InfrastructureAppError> {
  const span = ahead(now);
  return span === null
    ? okAsync(0)
    : deps.bookings.count(scope, {
        span,
        statuses: ['confirmed'],
        serviceId,
        ...(locationId === undefined ? {} : { locationId }),
        limit: 1,
        offset: 0,
      });
}

/** The bookings a closing service reaches: confirmed ones that have not started, at most one answer's worth. */
export function listFutureServiceBookings(
  deps: Reads,
  { scope, serviceId, locationId, now }: ServiceBookingsQuery,
): AppResultAsync<
  { readonly stored: readonly StoredBooking[]; readonly isTruncated: boolean },
  InfrastructureAppError
> {
  const span = ahead(now);
  return span === null
    ? okAsync({ stored: [], isTruncated: false })
    : deps.bookings
        .list(scope, {
          span,
          statuses: ['confirmed'],
          serviceId,
          ...(locationId === undefined ? {} : { locationId }),
          limit: MAX_IMPACT_BOOKINGS + 1,
          offset: 0,
        })
        .map((found) => ({
          stored: found.slice(0, MAX_IMPACT_BOOKINGS),
          isTruncated: found.length > MAX_IMPACT_BOOKINGS,
        }));
}

/** A booking as the review lists it: where and when, on its location's clock. Nothing about the person. */
export function toServiceBookingView(stored: StoredBooking, zone: TimeZone): ServiceBookingView {
  const { booking } = stored;
  return {
    bookingId: booking.id,
    locationId: booking.locationId,
    timeZone: zone,
    start: formatInstantInZone(booking.start, zone),
    end: formatInstantInZone(booking.end, zone),
  };
}
