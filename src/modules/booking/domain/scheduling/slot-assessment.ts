import type { ConflictAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  capacityExceeded,
  fieldValidationFailed,
  outsideBookingWindow,
  resourceUnavailable,
  slotUnavailable,
  BOOKING_VALIDATION_CODES,
} from '../errors/booking-errors';
import { sharedSessionKey } from '../models/booking';
import { compareLocalDates, toEpochDay } from '../time/local-date';
import { listCovers } from '../time/time-interval';
import { MS_PER_MINUTE } from '../time/time-of-day';
import { epochToZonedWallClock, zonedTimeToEpoch } from '../time/time-zone';

import { matchResources } from './resource-matching';

import type { ResourceDemand } from './resource-matching';
import type { ResourceTimeline, SchedulingIndex } from './scheduling-index';
import type { PlannedSlot, SlotAssessment, SlotRejection } from './scheduling-types';
import type { BookableResourceId } from '../models/ids';
import type { TimeInterval } from '../time/time-interval';

function rejected(reason: SlotRejection): SlotAssessment {
  return { kind: 'rejected', reason };
}

/**
 * Whether `start` is a point of the slot grid. The grid is defined on the
 * wall clock (every N minutes from local midnight), so it stays put across a
 * daylight-saving change instead of drifting by the hour; a wall-clock time
 * that does not exist, or the repeated second occurrence of one that exists
 * twice, is not a point of the grid.
 */
function isOnGrid(index: SchedulingIndex, start: number): boolean {
  const { date, minuteOfDay } = epochToZonedWallClock(start, index.zone);
  return (
    minuteOfDay % index.input.service.slotIntervalMinutes === 0 &&
    zonedTimeToEpoch(date, minuteOfDay, index.zone) === start
  );
}

/** First index of `spans` that could still overlap something starting at `from`. */
function firstRelevantSpan(timeline: ResourceTimeline, from: number): number {
  const threshold = from - timeline.longestBusyMs;
  let low = 0;
  let high = timeline.busy.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const span = timeline.busy[middle];
    if (span !== undefined && span.interval.start <= threshold) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function isHeldDuring(timeline: ResourceTimeline, occupied: TimeInterval): boolean {
  for (let i = firstRelevantSpan(timeline, occupied.start); i < timeline.busy.length; i += 1) {
    const span = timeline.busy[i];
    if (span === undefined || span.interval.start >= occupied.end) {
      return false;
    }
    if (span.interval.end > occupied.start) {
      return true;
    }
  }
  return false;
}

/** Code-unit order, not locale order: the same ids sort the same way on every machine. */
function compareIds(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function dayLoad(timeline: ResourceTimeline, epochDay: number): number {
  return timeline.loadByDay.get(epochDay) ?? 0;
}

interface Candidates {
  readonly demands: readonly ResourceDemand[];
  /** Whether a resource was free and qualified but too small for the group. */
  readonly sawTooSmall: boolean;
}

/**
 * The resources that could fill each unit of each requirement. A resource
 * qualifies when its own schedule covers the whole occupied time (including
 * preparation and clean-up), nothing else holds it then, and it is large
 * enough for the group. Candidates are ordered so that the least busy
 * resource of the day is preferred, then by id, which spreads bookings over a
 * pool and keeps the choice deterministic.
 */
function candidatesFor(
  index: SchedulingIndex,
  occupied: TimeInterval,
  participants: number,
  epochDay: number,
): Candidates {
  let sawTooSmall = false;
  const demands: ResourceDemand[] = [];
  index.input.service.requirements.forEach((requirement, position) => {
    const pool = index.pools[position] ?? [];
    const usable: ResourceTimeline[] = [];
    for (const timeline of pool) {
      if (!listCovers(timeline.free, occupied) || isHeldDuring(timeline, occupied)) {
        continue;
      }
      const { capacity } = timeline.resource;
      if (capacity !== null && capacity < participants) {
        sawTooSmall = true;
        continue;
      }
      usable.push(timeline);
    }
    usable.sort(
      (a, b) =>
        dayLoad(a, epochDay) - dayLoad(b, epochDay) || compareIds(a.resource.id, b.resource.id),
    );
    const ids = usable.map((timeline) => timeline.resource.id);
    for (let unit = 0; unit < requirement.count; unit += 1) {
      demands.push({ candidates: ids });
    }
  });
  return { demands, sawTooSmall };
}

/** The most participants a session can take on the given resources. */
function sessionCapacityOf(
  index: SchedulingIndex,
  resourceIds: readonly BookableResourceId[],
): number {
  let capacity = index.input.service.capacity.participantsPerSession;
  for (const resource of index.input.resources) {
    if (resourceIds.includes(resource.id) && resource.capacity !== null) {
      capacity = Math.min(capacity, resource.capacity);
    }
  }
  return capacity;
}

interface Plan {
  readonly start: number;
  readonly end: number;
  readonly occupied: TimeInterval;
  readonly resourceIds: readonly BookableResourceId[];
  readonly sessionKey: string | null;
  readonly sessionCapacity: number;
  readonly alreadyBooked: number;
  readonly joins: boolean;
}

function planned(plan: Plan): SlotAssessment {
  const slot: PlannedSlot = {
    start: plan.start,
    end: plan.end,
    occupied: plan.occupied,
    resourceIds: [...plan.resourceIds].sort(),
    sharedSessionKey: plan.sessionKey,
    sessionCapacity: plan.sessionCapacity,
    joinsExistingSession: plan.joins,
    remainingParticipants: plan.sessionCapacity - plan.alreadyBooked,
  };
  return { kind: 'planned', slot };
}

/**
 * Decides whether a group of `participants` can start at `start`, and if so
 * with which resources. The one place the booking rules live: the slot list,
 * the booking commands and the alternative suggestions all ask this, so they
 * can never disagree about what is bookable.
 *
 * The checks run cheapest and most explicable first, so the rejection tells a
 * visitor the real reason ("closed" rather than "no resource").
 */
export function assessSlot(
  index: SchedulingIndex,
  start: number,
  participants: number,
): SlotAssessment {
  const { service, location } = index.input;

  if (
    !Number.isInteger(participants) ||
    participants < 1 ||
    participants > service.capacity.participantsPerBooking
  ) {
    return rejected('invalid-participants');
  }
  if (!isOnGrid(index, start)) {
    return rejected('off-grid');
  }
  const startDate = epochToZonedWallClock(start, index.zone).date;
  if (start < index.earliestStart || compareLocalDates(startDate, index.latestDate) > 0) {
    return rejected('outside-booking-window');
  }

  const end = start + service.durationMinutes * MS_PER_MINUTE;
  const appointment: TimeInterval = { start, end };
  if (!listCovers(index.appointmentWindows, appointment)) {
    return rejected(
      listCovers(index.locationWindows, appointment) ? 'service-unavailable' : 'location-closed',
    );
  }

  const occupied: TimeInterval = {
    start: start - service.preparationMinutes * MS_PER_MINUTE,
    end: end + service.cleanupMinutes * MS_PER_MINUTE,
  };
  const key = sharedSessionKey({
    serviceId: service.id,
    locationId: location.id,
    start,
    participantsPerSession: service.capacity.participantsPerSession,
  });

  // A session someone already started keeps its resources: join it or be full.
  const session = key === null ? undefined : index.sessions.get(key);
  if (key !== null && session !== undefined) {
    const capacity = sessionCapacityOf(index, session.resourceIds);
    if (session.participants + participants > capacity) {
      return rejected('capacity-exceeded');
    }
    return planned({
      start,
      end,
      occupied,
      resourceIds: session.resourceIds,
      sessionKey: key,
      sessionCapacity: capacity,
      alreadyBooked: session.participants,
      joins: true,
    });
  }

  const { demands, sawTooSmall } = candidatesFor(
    index,
    occupied,
    participants,
    toEpochDay(startDate),
  );
  const assignment = matchResources(demands);
  if (assignment === null) {
    return rejected(sawTooSmall ? 'capacity-exceeded' : 'resources-unavailable');
  }
  return planned({
    start,
    end,
    occupied,
    resourceIds: assignment,
    sessionKey: key,
    sessionCapacity: sessionCapacityOf(index, assignment),
    alreadyBooked: 0,
    joins: false,
  });
}

/** `assessSlot` for callers that act on the answer: a rejection becomes the error the user sees. */
export function evaluateSlot(
  index: SchedulingIndex,
  start: number,
  participants: number,
): AppResult<PlannedSlot, ConflictAppError | ValidationAppError> {
  const assessment = assessSlot(index, start, participants);
  if (assessment.kind === 'planned') {
    return ok(assessment.slot);
  }
  switch (assessment.reason) {
    case 'invalid-participants':
      return err(
        fieldValidationFailed('participants', BOOKING_VALIDATION_CODES.participantsInvalid),
      );
    case 'outside-booking-window':
      return err(outsideBookingWindow());
    case 'resources-unavailable':
      return err(resourceUnavailable());
    case 'capacity-exceeded':
      return err(capacityExceeded());
    case 'off-grid':
    case 'location-closed':
    case 'service-unavailable':
      return err(slotUnavailable());
  }
}
