import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import { locationNotFound } from '../../domain/errors/booking-errors';
import { findAffectedBookings } from '../../domain/impact/find-affected-bookings';
import { placesOf } from '../../domain/models/bookable-resource';
import { asInstant } from '../../domain/time/instant';
import { formatInstantInZone } from '../../domain/time/instant-format';
import { createLocalDateRange } from '../../domain/time/local-date-range';
import { createInterval } from '../../domain/time/time-interval';
import { localDateOf } from '../../domain/time/time-zone';
import { IMPACT_HORIZON_DAYS, MAX_IMPACT_BOOKINGS } from '../booking-limits';

import { workingWindowsOf } from './scheduling-context';

import type { AffectedBooking, AvailabilityLoss } from '../../domain/impact/find-affected-bookings';
import type { BookableResource } from '../../domain/models/bookable-resource';
import type { Booking } from '../../domain/models/booking';
import type { CoverageSpell } from '../../domain/models/employee-coverage';
import type { BookingLocationId } from '../../domain/models/ids';
import type { BookingRepository, BookingScope } from '../../domain/ports/booking.repository';
import type {
  LocationAdminRepository,
  StoredLocation,
} from '../../domain/ports/location-admin.repository';
import type { StoredResource } from '../../domain/ports/resource-admin.repository';
import type { AvailabilityPlan } from '../../domain/scheduling/availability-plan';
import type { Instant } from '../../domain/time/instant';
import type { ResourceImpactView } from '../contracts/resource-views';

/** What a change of a resource can take away: when it can be used, and how many it takes at once. */
export interface ResourceUse {
  readonly availability: AvailabilityPlan | null;
  readonly capacity: number | null;
  /** Where an employee is sent instead of their own location, and when; absent for everything else. */
  readonly coverage?: readonly CoverageSpell[];
}

/**
 * The bookings a change of a resource would leave without it, that the resource as it is did not: a
 * booking that already had no room is not this change's doing and is not reported. Two losses are
 * asked about with the same rule the engine uses: time the resource can no longer be used (its own
 * hours inside the location's, minus its blocks: `workingWindowsOf`), and places it no longer has.
 * Only the bookings that hold this resource in the next year are read; when more exist than one
 * answer carries, `isTruncated` says so and the caller must treat the answer as incomplete.
 */
export function findResourceImpact(
  deps: { readonly bookings: Pick<BookingRepository, 'list'> },
  request: {
    readonly scope: BookingScope;
    readonly location: StoredLocation;
    /** A physical resource or an employee's calendar, as it is now. */
    readonly resource: Pick<BookableResource, 'id' | 'type'> & ResourceUse;
    readonly next: ResourceUse;
    readonly now: Instant;
    /**
     * An employee's calendar: it belongs to `home`, and only the bookings at `location` are asked about
     * (the same calendar is asked once for each place it is, or is going to be, used).
     */
    readonly placed?: { readonly home: BookingLocationId };
  },
): AppResultAsync<ResourceImpactView, InfrastructureAppError> {
  const { scope, location, resource, next, now, placed } = request;
  const ahead = createInterval(now, asInstant(now + IMPACT_HORIZON_DAYS * MS_PER_DAY));
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
      resourceId: resource.id,
      limit: MAX_IMPACT_BOOKINGS + 1,
      offset: 0,
    })
    .map((found) => {
      const bookings = found
        .slice(0, MAX_IMPACT_BOOKINGS)
        .map(({ booking }) => booking)
        .filter((booking) => placed === undefined || booking.locationId === location.id);
      const lossesOf = (use: ResourceUse): AvailabilityLoss[] => [
        {
          kind: 'resource',
          resourceId: resource.id,
          remaining: workingWindowsOf(
            {
              availability: use.availability,
              locationId: placed?.home ?? location.id,
              coverage: use.coverage ?? [],
            },
            location,
            dates,
          ),
        },
        {
          kind: 'places',
          resourceId: resource.id,
          places: placesOf({ type: resource.type, capacity: use.capacity }),
        },
      ];
      const affectedBy = (use: ResourceUse) =>
        lossesOf(use).flatMap((loss) => findAffectedBookings({ bookings, loss, now }));
      const before = new Set(affectedBy(resource).map(({ bookingId }) => bookingId));
      return {
        isTruncated: found.length > MAX_IMPACT_BOOKINGS,
        affected: viewsOf(firstReasonEach(affectedBy(next), before), bookings, location),
      };
    });
}

/** One entry per booking, the first reason it is affected for, without those affected already. */
function firstReasonEach(
  affected: readonly AffectedBooking[],
  before: ReadonlySet<string>,
): AffectedBooking[] {
  const seen = new Set(before);
  return affected.filter(({ bookingId }) => {
    const isNew = !seen.has(bookingId);
    seen.add(bookingId);
    return isNew;
  });
}

function viewsOf(
  affected: readonly AffectedBooking[],
  bookings: readonly Booking[],
  location: StoredLocation,
): ResourceImpactView['affected'] {
  const byId = new Map(bookings.map((booking) => [booking.id, booking]));
  return affected
    .flatMap(({ bookingId, reason }) => {
      const booking = byId.get(bookingId);
      return booking === undefined ? [] : [{ booking, reason }];
    })
    .sort((a, b) => a.booking.start - b.booking.start)
    .map(({ booking, reason }) => ({
      bookingId: booking.id,
      serviceId: booking.serviceId,
      timeZone: location.zone,
      start: formatInstantInZone(booking.start, location.zone),
      end: formatInstantInZone(booking.end, location.zone),
      reason,
    }));
}

/** The impact of a change of a stored resource, with its location read first (its clock and hours). */
export function impactOfChange(
  deps: {
    readonly bookings: Pick<BookingRepository, 'list'>;
    readonly locations: Pick<LocationAdminRepository, 'findById'>;
  },
  request: {
    readonly scope: BookingScope;
    readonly resource: StoredResource;
    readonly next: ResourceUse;
    readonly now: Instant;
  },
): AppResultAsync<ResourceImpactView, NotFoundAppError | InfrastructureAppError> {
  const { scope, resource } = request;
  return deps.locations
    .findById(scope, resource.locationId)
    .andThen((location) =>
      location === null
        ? errAsync(locationNotFound())
        : findResourceImpact(deps, { ...request, location }),
    );
}
