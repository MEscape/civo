import { addDays, daysBetween } from '../time/local-date';
import { epochToZonedWallClock, localDateOf } from '../time/time-zone';

import { findAvailableSlots } from './slot-finder';

import type { SchedulingIndex } from './scheduling-index';
import type { AvailableSlot, LocalDateRange } from './scheduling-types';
import type { TimeZone } from '../time/time-zone';

/** The days to search around a requested time. */
export function alternativeRange(
  requestedStart: number,
  zone: TimeZone,
  spanDays: number,
): LocalDateRange {
  const day = localDateOf(requestedStart, zone);
  return { from: addDays(day, -spanDays), to: addDays(day, spanDays) };
}

/**
 * Other times worth offering when the requested one is gone, nearest first:
 * the same day before other days, then by distance in days, then by how close
 * on the clock, then earlier before later. The ordering has no ties, so the
 * same input always yields the same list.
 */
export function suggestAlternativeSlots(
  index: SchedulingIndex,
  requestedStart: number,
  participants: number,
  limit: number,
): AvailableSlot[] {
  const requested = epochToZonedWallClock(requestedStart, index.zone);
  const ranked = findAvailableSlots(index, participants)
    .filter((slot) => slot.start !== requestedStart)
    .map((slot) => {
      const wallClock = epochToZonedWallClock(slot.start, index.zone);
      return {
        slot,
        dayDistance: Math.abs(daysBetween(requested.date, wallClock.date)),
        // Distance on the clock face, so "about the same time tomorrow" beats "an hour earlier tomorrow".
        timeDistance: Math.abs(wallClock.minuteOfDay - requested.minuteOfDay),
      };
    });
  ranked.sort(
    (a, b) =>
      a.dayDistance - b.dayDistance ||
      a.timeDistance - b.timeDistance ||
      a.slot.start - b.slot.start,
  );
  return ranked.slice(0, Math.max(0, limit)).map((entry) => entry.slot);
}
