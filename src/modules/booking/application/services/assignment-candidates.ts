import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { localDateOf } from '../../domain/time/time-zone';

import { loadBlocking, loadServingResources } from './blocking-reads';
import { scheduleOf, windowAround } from './scheduling-context';

import type { SchedulingError } from './scheduling-context';
import type { AssignmentCandidate } from '../../domain/assignment/assignment-eligibility';
import type { BookableResource } from '../../domain/models/bookable-resource';
import type { ServiceRequirement } from '../../domain/models/bookable-service';
import type { Booking } from '../../domain/models/booking';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { LocalDateRange } from '../../domain/time/local-date-range';
import type { BookingDependencies } from '../booking-dependencies';

type Reads = Pick<BookingDependencies, 'bookings' | 'resources'>;

/** The local days a booking touches. */
export function daysOf(booking: Booking, location: BookingLocationFacts): LocalDateRange {
  return {
    from: localDateOf(booking.start, location.zone),
    to: localDateOf(booking.end, location.zone),
  };
}

/**
 * Every resource that could fill `requirement` of a booking, each with its working hours inside the
 * location's and the bookings that already hold it (this booking excluded: it never conflicts with
 * itself). Eligibility is decided by the domain (`assessCandidates`) on what this returns.
 */
export function loadCandidates(
  deps: Reads,
  input: {
    readonly scope: BookingScope;
    readonly booking: Booking;
    readonly requirement: ServiceRequirement;
    readonly location: BookingLocationFacts;
    readonly now: Instant;
  },
): AppResultAsync<AssignmentCandidate[], SchedulingError | InfrastructureAppError> {
  const { scope, booking, requirement, location, now } = input;
  const window = windowAround(daysOf(booking, location));
  return loadServingResources(deps, { scope, location, types: [requirement.resourceType] }).andThen(
    (resources) =>
      loadBlocking(deps, {
        scope,
        location,
        window,
        now,
        resourceIds: resources.map((resource) => resource.id),
        except: [booking.id],
      }).map((blocking) =>
        resources.map((resource: BookableResource) => ({
          resource,
          schedule: scheduleOf(resource, { location, window, blocking }),
        })),
      ),
  );
}
