import { datesOf } from '../time/local-date-range';
import { resolveLocalTime } from '../time/local-time-resolution';
import { intervalsOverlap, listCovers, listOverlaps } from '../time/time-interval';
import { MINUTES_PER_DAY } from '../time/time-of-day';
import { wallClockOf } from '../time/time-zone';

import { hullOf, spanWithMargins } from './occupancy';
import { matchResources } from './resource-matching';
import { appointmentAt } from './slot-rules';
import { isStartAllowed } from './start-window';

import type {
  PlannedSlot,
  ResourceSchedule,
  Scheduling,
  SlotAssessment,
  SlotRejection,
} from './scheduling-types';
import type { SlotRules } from './slot-rules';
import type { Instant } from '../time/instant';
import type { LocalTimeResolution } from '../time/local-time-resolution';
import type { TimeInterval } from '../time/time-interval';

/**
 * The instant a grid point is offered at, or `null` if it is not offered. A wall-clock time the
 * clocks skip is never offered; one that happens twice is offered at its first occurrence only, so
 * the visitor is never shown two different "02:30"s. (Documented decision, BD-03.)
 */
function offeredInstant(resolution: LocalTimeResolution): Instant | null {
  switch (resolution.kind) {
    case 'exact':
      return resolution.instant;
    case 'ambiguous':
      return resolution.first;
    case 'gap':
      return null;
  }
}

/**
 * Whether `start` is a point of the start grid. The grid is every `stepMinutes` from LOCAL
 * midnight, on the wall clock, so it stays put across a daylight-saving change instead of drifting
 * by an hour, and it does not depend on the duration.
 */
function isGridStart(scheduling: Scheduling, start: Instant): boolean {
  const { date, minuteOfDay } = wallClockOf(start, scheduling.zone);
  return (
    minuteOfDay % scheduling.rules.stepMinutes === 0 &&
    offeredInstant(resolveLocalTime(date, minuteOfDay, scheduling.zone)) === start
  );
}

/**
 * What the resource is held for around this appointment: its own margins (`marginsOf`) or, when none
 * are given, the staff buffers of the service.
 */
function spanFor(
  resource: ResourceSchedule,
  appointment: TimeInterval,
  rules: SlotRules,
): TimeInterval {
  return spanWithMargins(
    appointment,
    resource.margins ?? { before: rules.preparationMinutes, after: rules.cleanupMinutes },
  );
}

function isFreeFor(resource: ResourceSchedule, span: TimeInterval): boolean {
  return listCovers(resource.availability, span) && !listOverlaps(resource.busy, span);
}

function rejected(reason: SlotRejection): SlotAssessment {
  return { kind: 'rejected', reason };
}

/** What each chosen resource is held for, by id. */
function spansOf(
  scheduling: Scheduling,
  appointment: TimeInterval,
  resourceIds: readonly string[],
): Record<string, TimeInterval> {
  const known = new Map(
    scheduling.pools.flatMap((pool) => pool.resources.map((resource) => [resource.id, resource])),
  );
  return Object.fromEntries(
    resourceIds.flatMap((id) => {
      const resource = known.get(id);
      return resource === undefined ? [] : [[id, spanFor(resource, appointment, scheduling.rules)]];
    }),
  );
}

/**
 * The open units of other bookings that compete with this one: they fall in the time an employee is
 * held for it and could be taken by one of the employees it counts on. They are matched together with
 * the new booking's own demands, so a unit already promised to an employee leaves one fewer for it.
 */
function competingDemands(
  scheduling: Scheduling,
  appointment: TimeInterval,
  wanted: ReadonlySet<string>,
): string[][] {
  const { rules, openDemands } = scheduling;
  const staffSpan = spanWithMargins(appointment, {
    before: rules.preparationMinutes,
    after: rules.cleanupMinutes,
  });
  return openDemands
    .filter(
      (demand) =>
        intervalsOverlap(demand.span, staffSpan) &&
        demand.candidateIds.some((id) => wanted.has(id)),
    )
    .map(({ candidateIds }) => [...candidateIds]);
}

/** The assessment of a start already known to be on the grid. */
function assessGridStart(scheduling: Scheduling, start: Instant): SlotAssessment {
  if (!isStartAllowed(scheduling.startWindow, start)) {
    return rejected('outside-start-window');
  }
  const appointment = appointmentAt(start, scheduling.rules);
  if (!listCovers(scheduling.openWindows, appointment)) {
    return rejected('outside-open-hours');
  }
  const { rules } = scheduling;
  const demands = scheduling.pools.flatMap((pool) => {
    const candidates = pool.resources
      .filter((resource) => isFreeFor(resource, spanFor(resource, appointment, rules)))
      .map((resource) => resource.id);
    return Array.from({ length: pool.count }, () => candidates);
  });
  const wanted = new Set(demands.flat());
  const matched = matchResources([
    ...demands,
    ...competingDemands(scheduling, appointment, wanted),
  ]);
  if (matched === null) {
    return rejected('resources-unavailable');
  }
  // The units of other bookings only used up resources; the answer is for this booking's own.
  const assignment = matched.slice(0, demands.length);
  const resourceSpans = spansOf(scheduling, appointment, assignment);
  let offset = 0;
  const requirementResourceIds = scheduling.pools.map((pool) => {
    const ids = assignment.slice(offset, offset + pool.count);
    offset += pool.count;
    return ids;
  });
  return {
    kind: 'planned',
    slot: {
      start,
      end: appointment.end,
      occupied: hullOf([appointment, ...Object.values(resourceSpans)]) ?? appointment,
      resourceSpans,
      resourceIds: [...assignment].sort(),
      requirementResourceIds,
    },
  };
}

/**
 * Decides whether an appointment can start at `start`, and with which resources. The one place the
 * booking rules live: the slot list and any later check of a chosen start ask this, so they cannot
 * disagree. Independent of `range`, which only bounds what `findSlots` lists.
 */
export function assessSlot(scheduling: Scheduling, start: Instant): SlotAssessment {
  return isGridStart(scheduling, start) ? assessGridStart(scheduling, start) : rejected('off-grid');
}

/**
 * Every bookable start on the local days of the range, earliest first. Deterministic: equal input
 * gives the same list in the same order, whatever the order of the input lists.
 */
export function findSlots(scheduling: Scheduling): PlannedSlot[] {
  const slots: PlannedSlot[] = [];
  for (const date of datesOf(scheduling.range)) {
    for (let minute = 0; minute < MINUTES_PER_DAY; minute += scheduling.rules.stepMinutes) {
      const start = offeredInstant(resolveLocalTime(date, minute, scheduling.zone));
      const assessment = start === null ? null : assessGridStart(scheduling, start);
      if (assessment?.kind === 'planned') {
        slots.push(assessment.slot);
      }
    }
  }
  return slots;
}
