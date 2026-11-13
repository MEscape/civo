import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { ResultAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { canServeRequirement } from '../../domain/assignment/assignment-eligibility';
import { placesOf } from '../../domain/models/bookable-resource';
import { isWorkingAt } from '../../domain/models/employee-coverage';
import { availabilityOnRange } from '../../domain/scheduling/availability-plan';
import { marginsOf } from '../../domain/scheduling/occupancy';
import { prepareScheduling } from '../../domain/scheduling/prepare-scheduling';
import { MAX_HORIZON_DAYS, createStartWindow } from '../../domain/scheduling/start-window';
import { addLocalDays } from '../../domain/time/local-date';
import { datesOf } from '../../domain/time/local-date-range';
import { startOfLocalDay } from '../../domain/time/local-time-resolution';
import {
  intersectIntervals,
  intervalsAtDepth,
  mergeIntervals,
} from '../../domain/time/time-interval';

import { loadBlocking, loadServingResources } from './blocking-reads';
import { loadOpenBookings, openDemandsOf } from './open-demands';

import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookableService } from '../../domain/models/bookable-service';
import type { Booking } from '../../domain/models/booking';
import type { BookingId } from '../../domain/models/ids';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { AvailabilityPlan } from '../../domain/scheduling/availability-plan';
import type { ResourceSchedule, Scheduling } from '../../domain/scheduling/scheduling-types';
import type { Instant } from '../../domain/time/instant';
import type { LocalDateRange } from '../../domain/time/local-date-range';
import type { TimeInterval } from '../../domain/time/time-interval';
import type { BookingDependencies, BookingFlowDependencies } from '../booking-dependencies';

type Reads = Pick<BookingDependencies | BookingFlowDependencies, 'bookings' | 'resources'>;

export type SchedulingError = InfrastructureAppError | ValidationAppError | ConflictAppError;

/** Who is asking decides which limits apply to when a booking may start. */
export type StartRules = 'customer' | 'staff';

export interface SchedulingRequest {
  readonly scope: BookingScope;
  readonly service: BookableService;
  readonly location: BookingLocationFacts;
  /** The local days whose start times are asked about. */
  readonly range: LocalDateRange;
  readonly now: Instant;
  /**
   * A customer starts after the service's notice and before its horizon. Staff are bound by
   * neither: a manager may book at short notice and far ahead (BD-19); a resource conflict still
   * refuses them.
   */
  readonly startRules: StartRules;
  /** A booking being moved; it must not block its own new time. */
  readonly ignoreBookingId?: BookingId;
}

/** Local days gathered a day either side of the range: a start can need time from the day before, and an appointment can cross midnight. */
const SLACK_DAYS = 1;

/** The days around `range` that the schedule is gathered for. */
export function windowAround(range: LocalDateRange): LocalDateRange {
  return { from: addLocalDays(range.from, -SLACK_DAYS), to: addLocalDays(range.to, SLACK_DAYS) };
}

/** When a resource can work over `window`: its own hours inside the place's, or the place's. */
export function workingWindows(
  availability: AvailabilityPlan | null,
  location: Pick<BookingLocationFacts, 'openingHours' | 'zone'>,
  window: LocalDateRange,
): TimeInterval[] {
  const locationWindows = availabilityOnRange(location.openingHours, window, location.zone);
  return availability === null
    ? locationWindows
    : intersectIntervals(availabilityOnRange(availability, window, location.zone), locationWindows);
}

/**
 * When a resource can work at the location over `window`: `workingWindows`, on the days it is there.
 * An employee sent to another location (a coverage spell) works there on those days and is away from
 * their own; everything else is wherever its hours say.
 */
export function workingWindowsOf(
  resource: Pick<BookableResource, 'availability' | 'locationId' | 'coverage'>,
  location: Pick<BookingLocationFacts, 'id' | 'openingHours' | 'zone'>,
  window: LocalDateRange,
): TimeInterval[] {
  const windows = workingWindows(resource.availability, location, window);
  if (resource.coverage.length === 0) {
    return windows;
  }
  const days = datesOf(window)
    .filter((date) => isWorkingAt(resource, location.id, date))
    .map((date) => ({
      start: startOfLocalDay(date, location.zone),
      end: startOfLocalDay(addLocalDays(date, 1), location.zone),
    }));
  return intersectIntervals(windows, mergeIntervals(days));
}

/** What one resource contributes: when it works inside the place's hours, and what already holds it. */
export function scheduleOf(
  resource: BookableResource,
  around: {
    readonly location: BookingLocationFacts;
    readonly window: LocalDateRange;
    readonly blocking: readonly Booking[];
  },
): ResourceSchedule {
  const { location, window, blocking } = around;
  return {
    id: resource.id,
    availability: workingWindowsOf(resource, location, window),
    // What a booking holds THIS resource for, which is not what it holds the others for; a
    // resource with several places is taken only where all of them are.
    busy: intervalsAtDepth(
      blocking.flatMap((booking) =>
        booking.assignments
          .filter((unit) => unit.resourceId === resource.id)
          .map((unit) => unit.occupied),
      ),
      placesOf(resource),
    ),
  };
}

/**
 * Loads what the scheduling engine needs for a span of days and prepares its question: the
 * location's hours narrowed by the service's own, the resources that can ever serve each
 * requirement with their working hours (the location's own and those that serve every location),
 * and the bookings that hold one of them around the span: other locations' bookings are not read.
 * The loads are bounded; more resources or bookings than the bounds is refused as too large
 * instead of being answered from a partial picture. The database constraint, not this read, is what finally
 * prevents a double booking.
 */
export function loadScheduling(
  deps: Reads,
  request: SchedulingRequest,
): AppResultAsync<Scheduling, SchedulingError> {
  const { scope, service, location, range, now, ignoreBookingId } = request;
  const window = windowAround(range);
  const types = unique(service.requirements.map((requirement) => requirement.resourceType));

  const except = ignoreBookingId === undefined ? [] : [ignoreBookingId];

  return loadServingResources(deps, { scope, location, types }).andThen((resources) =>
    ResultAsync.combine([
      loadBlocking(deps, {
        scope,
        location,
        window,
        now,
        resourceIds: resources.map((resource) => resource.id),
        except,
      }),
      // Bookings that wait for an employee hold nobody, but they will need one: only a service that
      // needs an employee has to leave room for them.
      types.includes('employee')
        ? loadOpenBookings(deps, { scope, location, now, except })
        : okAsync<readonly StoredBooking[]>([]),
    ] as const).andThen(([blocking, open]) =>
      prepare(request, { resources, blocking, open, window }),
    ),
  );
}

function prepare(
  request: SchedulingRequest,
  loaded: {
    readonly resources: readonly BookableResource[];
    readonly blocking: readonly Booking[];
    readonly open: readonly StoredBooking[];
    readonly window: LocalDateRange;
  },
): AppResultAsync<Scheduling, ValidationAppError> {
  const { resources, blocking, open, window } = loaded;
  const { service, location, range, now, startRules } = request;
  const locationWindows = availabilityOnRange(location.openingHours, window, location.zone);
  const openWindows =
    service.availability === null
      ? locationWindows
      : intersectIntervals(
          locationWindows,
          availabilityOnRange(service.availability, window, location.zone),
        );
  const schedules = new Map(
    resources.map((resource) => [
      resource.id,
      {
        ...scheduleOf(resource, { location, window, blocking }),
        margins: marginsOf(
          {
            id: resource.id,
            isEmployee: resource.type === 'employee',
            setupMinutes: resource.setupMinutes,
            teardownMinutes: resource.teardownMinutes,
          },
          service.rules,
        ),
      },
    ]),
  );
  const requirements = service.requirements.map((requirement) => ({
    count: requirement.count,
    resources: resources
      .filter((resource) => canServeRequirement(resource, requirement, location.id))
      .flatMap((resource) => schedules.get(resource.id) ?? []),
  }));
  const isCustomer = startRules === 'customer';
  return createStartWindow({
    now,
    zone: location.zone,
    noticeMinutes: isCustomer ? service.noticeMinutes : 0,
    horizonDays: isCustomer ? service.horizonDays : MAX_HORIZON_DAYS,
  })
    .andThen((startWindow) =>
      prepareScheduling({
        zone: location.zone,
        range,
        rules: service.rules,
        startWindow,
        openWindows,
        requirements,
        openDemands: openDemandsOf(open, {
          employees: resources.filter(({ type }) => type === 'employee'),
          schedules,
        }),
      }),
    )
    .asyncAndThen((scheduling) => okAsync(scheduling));
}
