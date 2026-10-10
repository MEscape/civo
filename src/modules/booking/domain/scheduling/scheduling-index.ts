import { servesLocation } from '../models/bookable-resource';
import { isBlocking } from '../models/booking';
import { addDays, toEpochDay } from '../time/local-date';
import { intersectIntervals } from '../time/time-interval';
import { MS_PER_MINUTE } from '../time/time-of-day';
import { localDateOf } from '../time/time-zone';

import { windowsForRange } from './availability-windows';

import type { LocalDateRange, SchedulingInput } from './scheduling-types';
import type { BookableResource, ResourceKind } from '../models/bookable-resource';
import type { ResourceRequirement } from '../models/bookable-service';
import type { Booking } from '../models/booking';
import type { BookableResourceId } from '../models/ids';
import type { LocalDate } from '../time/local-date';
import type { TimeInterval } from '../time/time-interval';
import type { TimeZone } from '../time/time-zone';

/** One booking's hold on a resource. */
export interface BusySpan {
  readonly interval: TimeInterval;
  /** Spans of the same session may overlap: they share the resource instead of competing for it. */
  readonly sessionKey: string;
}

/**
 * A resource as the engine sees it for one query: when its own schedule lets
 * it work, what existing bookings already hold of it, and how busy it is on
 * each day (used to spread bookings over the pool).
 */
export interface ResourceTimeline {
  readonly resource: BookableResource;
  readonly free: readonly TimeInterval[];
  /** Sorted by start. */
  readonly busy: readonly BusySpan[];
  readonly longestBusyMs: number;
  /** Occupied minutes by local epoch day. */
  readonly loadByDay: ReadonlyMap<number, number>;
}

/** Participants already in a shared session, and the resources it holds. */
export interface SessionState {
  readonly participants: number;
  readonly resourceIds: readonly BookableResourceId[];
}

/**
 * Everything derived from the input once per query, so assessing the
 * hundreds of candidate start times in a range costs lookups, not
 * recomputation. Built by `buildSchedulingIndex`; read by the assessor.
 */
export interface SchedulingIndex {
  readonly input: SchedulingInput;
  readonly zone: TimeZone;
  readonly range: LocalDateRange;
  readonly locationWindows: readonly TimeInterval[];
  /** Where an appointment may lie: the location's hours narrowed by the service's own. */
  readonly appointmentWindows: readonly TimeInterval[];
  readonly timelines: ReadonlyMap<BookableResourceId, ResourceTimeline>;
  /** The timelines able to fill each requirement, in the service's requirement order. */
  readonly pools: ReadonlyArray<readonly ResourceTimeline[]>;
  readonly sessions: ReadonlyMap<string, SessionState>;
  /** The earliest start the notice period allows, epoch milliseconds. */
  readonly earliestStart: number;
  /** The last local day a booking may start on. */
  readonly latestDate: LocalDate;
  readonly stepMs: number;
}

function isEligible(
  resource: BookableResource,
  requirement: ResourceRequirement,
  input: SchedulingInput,
): boolean {
  return (
    resource.isActive &&
    resource.type === requirement.resourceType &&
    requirement.skills.every((skill) => resource.skills.includes(skill)) &&
    servesLocation(resource, input.location.id) &&
    (requirement.resourceIds === null || requirement.resourceIds.includes(resource.id))
  );
}

function busySpansOf(
  resource: BookableResource,
  bookings: readonly Booking[],
): { spans: BusySpan[]; longest: number } {
  const spans = bookings
    .filter((booking) => booking.resourceIds.includes(resource.id))
    .map((booking) => ({
      interval: { start: booking.occupiedStart.getTime(), end: booking.occupiedEnd.getTime() },
      sessionKey: booking.sessionKey,
    }))
    .sort((a, b) => a.interval.start - b.interval.start);
  const longest = spans.reduce(
    (max, span) => Math.max(max, span.interval.end - span.interval.start),
    0,
  );
  return { spans, longest };
}

function loadOf(spans: readonly BusySpan[], zone: TimeZone): Map<number, number> {
  const load = new Map<number, number>();
  for (const span of spans) {
    const day = toEpochDay(localDateOf(span.interval.start, zone));
    const minutes = (span.interval.end - span.interval.start) / MS_PER_MINUTE;
    load.set(day, (load.get(day) ?? 0) + minutes);
  }
  return load;
}

function sessionsOf(
  input: SchedulingInput,
  blocking: readonly Booking[],
): Map<string, SessionState> {
  const sessions = new Map<string, SessionState>();
  if (input.service.capacity.participantsPerSession <= 1) {
    return sessions;
  }
  for (const booking of blocking) {
    if (
      booking.serviceId !== input.service.id ||
      booking.locationId !== input.location.id ||
      !booking.sessionKey.startsWith('session:')
    ) {
      continue;
    }
    const known = sessions.get(booking.sessionKey);
    sessions.set(booking.sessionKey, {
      participants: (known?.participants ?? 0) + booking.participants,
      resourceIds: known?.resourceIds ?? booking.resourceIds,
    });
  }
  return sessions;
}

function resourceTypesOf(requirements: readonly ResourceRequirement[]): ReadonlySet<ResourceKind> {
  return new Set(requirements.map((requirement) => requirement.resourceType));
}

/**
 * Prepares one query. `range` is the span of local days whose start times
 * will be assessed; windows and bookings are gathered a day either side of
 * it, because a start on the first day can need resource time from the day
 * before (preparation) and an appointment can run across midnight.
 */
export function buildSchedulingIndex(
  input: SchedulingInput,
  range: LocalDateRange,
): SchedulingIndex {
  const { service, location, now } = input;
  const zone = location.timeZone;
  const windowFrom = addDays(range.from, -1);
  const windowTo = addDays(range.to, 1);

  const locationWindows = windowsForRange(location.openingHours, windowFrom, windowTo, zone);
  const serviceWindows =
    service.availability === null
      ? null
      : windowsForRange(service.availability, windowFrom, windowTo, zone);
  const appointmentWindows =
    serviceWindows === null ? locationWindows : intersectIntervals(locationWindows, serviceWindows);

  const blocking = input.bookings.filter(
    (booking) => booking.id !== input.ignoreBookingId && isBlocking(booking, now),
  );

  const types = resourceTypesOf(service.requirements);
  const timelines = new Map<BookableResourceId, ResourceTimeline>();
  for (const resource of input.resources) {
    if (!types.has(resource.type) || !resource.isActive) {
      continue;
    }
    const own =
      resource.availability === null
        ? locationWindows
        : intersectIntervals(
            windowsForRange(resource.availability, windowFrom, windowTo, zone),
            locationWindows,
          );
    const { spans, longest } = busySpansOf(resource, blocking);
    timelines.set(resource.id, {
      resource,
      free: own,
      busy: spans,
      longestBusyMs: longest,
      loadByDay: loadOf(spans, zone),
    });
  }

  const pools = service.requirements.map((requirement) =>
    [...timelines.values()].filter((timeline) => isEligible(timeline.resource, requirement, input)),
  );

  return {
    input,
    zone,
    range,
    locationWindows,
    appointmentWindows,
    timelines,
    pools,
    sessions: sessionsOf(input, blocking),
    earliestStart: now.getTime() + service.noticeMinutes * MS_PER_MINUTE,
    latestDate: addDays(localDateOf(now.getTime(), zone), service.horizonDays),
    stepMs: service.slotIntervalMinutes * MS_PER_MINUTE,
  };
}
