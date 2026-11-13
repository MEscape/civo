import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import { findAffectedBookings } from '../../domain/impact/find-affected-bookings';
import { availabilityOnRange } from '../../domain/scheduling/availability-plan';
import { asInstant } from '../../domain/time/instant';
import { formatInstantInZone } from '../../domain/time/instant-format';
import { createLocalDateRange } from '../../domain/time/local-date-range';
import { createInterval } from '../../domain/time/time-interval';
import { localDateOf } from '../../domain/time/time-zone';
import { FUTURE_BOOKINGS_DAYS, IMPACT_HORIZON_DAYS, MAX_IMPACT_BOOKINGS } from '../booking-limits';

import type { BookingLocationId } from '../../domain/models/ids';
import type { BookingRepository, BookingScope } from '../../domain/ports/booking.repository';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { AvailabilityPlan } from '../../domain/scheduling/availability-plan';
import type { Instant } from '../../domain/time/instant';
import type { TimeZone } from '../../domain/time/time-zone';
import type { LocationImpactView } from '../contracts/location-views';

/** What the two reads below need of the bookings. */
export interface LocationBookingReads {
  readonly bookings: Pick<BookingRepository, 'list' | 'count'>;
}

const span = (from: Instant, days: number) =>
  createInterval(from, asInstant(from + days * MS_PER_DAY));

/** Which location, whose website, and from when. */
export interface FutureBookingsQuery {
  readonly scope: BookingScope;
  readonly locationId: BookingLocationId;
  readonly now: Instant;
}

/** Confirmed bookings at a location that have not started yet. */
export function countFutureBookings(
  deps: LocationBookingReads,
  { scope, locationId, now }: FutureBookingsQuery,
): AppResultAsync<number, InfrastructureAppError> {
  const ahead = span(now, FUTURE_BOOKINGS_DAYS);
  return ahead === null
    ? okAsync(0)
    : deps.bookings.count(scope, {
        span: ahead,
        statuses: ['confirmed'],
        locationId,
        limit: 1,
        offset: 0,
      });
}

/**
 * The bookings a new set of opening hours would leave outside, that the old one did not: a booking
 * that already sat outside is not this change's doing and is not reported. The calendar work is the
 * engine's (`availabilityOnRange` for both plans) and the question "who is left outside" is the
 * impact analysis's (`findAffectedBookings`); this only asks both for the bookings of one location
 * in the next year. When more bookings exist than one answer carries, `isTruncated` says so and the
 * caller must treat the answer as incomplete.
 */
export function findNewlyAffected(
  deps: LocationBookingReads,
  request: {
    readonly scope: BookingScope;
    readonly location: StoredLocation;
    readonly nextPlan: AvailabilityPlan;
    /** The zone the new hours are read in: a location that changes zone changes both at once. */
    readonly nextZone: TimeZone;
    readonly now: Instant;
  },
): AppResultAsync<LocationImpactView, InfrastructureAppError> {
  const { scope, location, nextPlan, nextZone, now } = request;
  const ahead = span(now, IMPACT_HORIZON_DAYS);
  const dates =
    ahead === null
      ? null
      : createLocalDateRange(
          localDateOf(now, location.zone),
          localDateOf(ahead.end, location.zone),
          IMPACT_HORIZON_DAYS + 2,
        );
  if (ahead === null || dates === null) {
    return okAsync({ affected: [], isTruncated: false });
  }

  return deps.bookings
    .list(scope, {
      span: ahead,
      statuses: ['confirmed', 'held'],
      locationId: location.id,
      limit: MAX_IMPACT_BOOKINGS + 1,
      offset: 0,
    })
    .map((found) => {
      const stored = found.slice(0, MAX_IMPACT_BOOKINGS);
      const bookings = stored.map(({ booking }) => booking);
      const outsideWith = (plan: AvailabilityPlan, zone: TimeZone) =>
        findAffectedBookings({
          bookings,
          loss: {
            kind: 'opening-hours',
            locationId: location.id,
            remaining: availabilityOnRange(plan, dates, zone),
          },
          now,
        });
      const alreadyOutside = new Set(
        outsideWith(location.openingHours, location.zone).map((a) => a.bookingId),
      );
      const byId = new Map(bookings.map((booking) => [booking.id, booking]));

      return {
        isTruncated: found.length > MAX_IMPACT_BOOKINGS,
        affected: outsideWith(nextPlan, nextZone).flatMap(({ bookingId, reason }) => {
          const booking = byId.get(bookingId);
          return booking === undefined || alreadyOutside.has(bookingId)
            ? []
            : [
                {
                  bookingId,
                  serviceId: booking.serviceId,
                  timeZone: location.zone,
                  start: formatInstantInZone(booking.start, location.zone),
                  end: formatInstantInZone(booking.end, location.zone),
                  reason,
                },
              ];
        }),
      };
    });
}
