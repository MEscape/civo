import { placesOf } from '../../domain/models/bookable-resource';
import { isBlocking, spanOfResource } from '../../domain/models/booking';
import { blocksOf, followsLocation, ownWeekOf } from '../../domain/models/resource-availability';
import { availabilityOnDate } from '../../domain/scheduling/availability-plan';
import { WEEKDAYS } from '../../domain/scheduling/weekly-hours';
import { instantToDate } from '../../domain/time/instant';
import { formatInstantInZone } from '../../domain/time/instant-format';
import { formatLocalDate, toEpochDay } from '../../domain/time/local-date';
import { intervalsAtDepth, subtractIntervals } from '../../domain/time/time-interval';
import { localDateOf } from '../../domain/time/time-zone';

import { toDayInput } from './location-views';

import type { Booking } from '../../domain/models/booking';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { ResourceUser, StoredResource } from '../../domain/ports/resource-admin.repository';
import type { Instant } from '../../domain/time/instant';
import type { TimeInterval } from '../../domain/time/time-interval';
import type { TimeZone } from '../../domain/time/time-zone';
import type {
  ResourceBusyView,
  ResourceStatus,
  ResourceSummaryView,
  ResourceTodayView,
  ResourceView,
} from '../contracts/resource-views';

/** What a resource's views are drawn from besides the resource itself. */
export interface ResourceContext {
  readonly location: StoredLocation;
  /** The bookings that block today at the location (any resource); the resource's own are picked out. */
  readonly today: readonly Booking[];
  readonly users: readonly ResourceUser[];
  /** The location has more services using its resources than one read names; `users` is partial. */
  readonly isUsersTruncated: boolean;
  readonly now: Instant;
}

const slot = (span: TimeInterval, zone: TimeZone) => ({
  start: formatInstantInZone(span.start, zone),
  end: formatInstantInZone(span.end, zone),
});

/** The most of `spans` that overlap at one moment. */
function peakOf(spans: readonly TimeInterval[]): number {
  let peak = 0;
  while (intervalsAtDepth(spans, peak + 1).length > 0) {
    peak += 1;
  }
  return peak;
}

/** How the resource is held today: in use, full, and at most by how many at once. */
function todayOf(resource: StoredResource, context: ResourceContext): ResourceTodayView {
  const { location, now } = context;
  const zone = location.zone;
  const opening = availabilityOnDate(location.openingHours, localDateOf(now, zone), zone);
  const first = opening[0];
  const last = opening.at(-1);
  const spans = context.today
    .filter(
      (booking) =>
        isBlocking(booking, now) &&
        booking.assignments.some((unit) => unit.resourceId === resource.id),
    )
    .map((booking) => spanOfResource(booking, resource.id));
  const full = intervalsAtDepth(spans, placesOf(resource));
  const busy: ResourceBusyView[] = [
    ...full.map((span) => ({ ...slot(span, zone), isFull: true })),
    ...subtractIntervals(intervalsAtDepth(spans, 1), full).map((span) => ({
      ...slot(span, zone),
      isFull: false,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  return {
    timeZone: zone,
    window:
      first === undefined || last === undefined
        ? null
        : slot({ start: first.start, end: last.end }, zone),
    busy,
    peak: peakOf(spans),
  };
}

function statusOf(resource: StoredResource, zone: TimeZone, now: Instant): ResourceStatus {
  if (!resource.isActive) {
    return 'inactive';
  }
  const today = toEpochDay(localDateOf(now, zone));
  const isBlocked = blocksOf(resource.availability).some(
    (block) => toEpochDay(block.from) <= today && today <= toEpochDay(block.to),
  );
  return isBlocked ? 'blocked' : 'active';
}

/** A resource in a list: what it is, how many it takes, who uses it, and how it is used today. */
export function toResourceSummary(
  resource: StoredResource,
  context: ResourceContext,
): ResourceSummaryView {
  return {
    id: resource.id,
    name: resource.name,
    type: resource.type,
    places: placesOf(resource),
    status: statusOf(resource, context.location.zone, context.now),
    usedBy: context.users
      .filter((user) => user.resourceId === resource.id)
      .map(({ serviceId, serviceName, isRequired }) => ({ serviceId, serviceName, isRequired })),
    today: todayOf(resource, context),
  };
}

/** A resource in the shape its forms edit, with the version a change must name. */
export function toResourceView(
  resource: StoredResource,
  context: ResourceContext & { readonly websiteId: string },
): ResourceView {
  const { location } = context;
  const ownWeek = ownWeekOf(resource.availability);
  const locationWeekly = WEEKDAYS.map((weekday) =>
    toDayInput(location.openingHours.weekly[weekday]),
  );
  return {
    ...toResourceSummary(resource, context),
    websiteId: context.websiteId,
    location: { id: location.id, name: location.name },
    setupMinutes: resource.setupMinutes,
    teardownMinutes: resource.teardownMinutes,
    internalNote: resource.internalNote ?? '',
    followsLocation: followsLocation(resource.availability),
    weekly:
      ownWeek === null ? locationWeekly : WEEKDAYS.map((weekday) => toDayInput(ownWeek[weekday])),
    locationWeekly,
    blocks: blocksOf(resource.availability).map(({ from, to }) => ({
      from: formatLocalDate(from),
      to: formatLocalDate(to),
    })),
    version: instantToDate(resource.updatedAt).toISOString(),
  };
}
