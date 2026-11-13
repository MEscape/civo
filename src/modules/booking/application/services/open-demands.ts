import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { canServeRequirement } from '../../domain/assignment/assignment-eligibility';
import { scheduleTooLarge } from '../../domain/errors/booking-errors';
import { openDemandOf } from '../../domain/scheduling/open-demand';
import { MAX_BLOCKING_BOOKINGS_PER_QUERY } from '../booking-limits';

import type { BookableResource } from '../../domain/models/bookable-resource';
import type { Booking } from '../../domain/models/booking';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { OpenDemand } from '../../domain/scheduling/open-demand';
import type { ResourceSchedule } from '../../domain/scheduling/scheduling-types';
import type { Instant } from '../../domain/time/instant';
import type { BookingDependencies, BookingFlowDependencies } from '../booking-dependencies';

type Reads = Pick<BookingDependencies | BookingFlowDependencies, 'bookings'>;

/**
 * The bookings of the location that still wait for an employee: what a new booking has to leave
 * room for, because they hold nobody yet but will need somebody. A location with more of them than
 * one answer may be built from is refused as too large instead of being judged on a cut list.
 */
export function loadOpenBookings(
  deps: Reads,
  around: {
    readonly scope: BookingScope;
    readonly location: BookingLocationFacts;
    readonly now: Instant;
    readonly except: ReadonlyArray<Booking['id']>;
  },
): AppResultAsync<
  readonly StoredBooking[],
  InfrastructureAppError | ReturnType<typeof scheduleTooLarge>
> {
  const { scope, location, now, except } = around;
  return deps.bookings
    .listOpen(scope, {
      now,
      locationId: location.id,
      // One more than the bound: it tells a full list from a cut one.
      limit: MAX_BLOCKING_BOOKINGS_PER_QUERY + 1,
    })
    .andThen((open) =>
      open.length > MAX_BLOCKING_BOOKINGS_PER_QUERY
        ? errAsync(scheduleTooLarge())
        : okAsync(open.filter(({ booking }) => !except.includes(booking.id))),
    );
}

/**
 * What each open employee unit of `open` will ask of the team: the employees able to take it, free
 * for all of it. A booking made before its requirements were kept has no unit to read them from and
 * counts for nothing (the employees it needs are not known).
 */
export function openDemandsOf(
  open: readonly StoredBooking[],
  team: {
    readonly employees: readonly BookableResource[];
    readonly schedules: ReadonlyMap<string, ResourceSchedule>;
  },
): OpenDemand[] {
  return open.flatMap(({ booking, placement }) =>
    booking.assignments.flatMap((unit) => {
      const requirement = placement.snapshot?.requirements[unit.requirementIndex];
      if (
        unit.resourceId !== null ||
        unit.resourceType !== 'employee' ||
        requirement === undefined
      ) {
        return [];
      }
      const candidates = team.employees
        .filter((employee) => canServeRequirement(employee, requirement, booking.locationId))
        .flatMap(({ id }) => team.schedules.get(id) ?? []);
      return [openDemandOf(unit.occupied, candidates)];
    }),
  );
}
