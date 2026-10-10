import { MS_PER_MINUTE } from '@lib/utils';

import { eachLocalDate } from '../time/local-date';
import { listCovers } from '../time/time-interval';
import { MINUTES_PER_DAY } from '../time/time-of-day';
import { zonedTimeToEpoch } from '../time/time-zone';

import { assessSlot } from './slot-assessment';

import type { SchedulingIndex } from './scheduling-index';
import type { AvailableSlot } from './scheduling-types';

/**
 * Every bookable start time in the index's range for a group of
 * `participants`, earliest first.
 *
 * Candidates are the wall-clock grid points of each local day. Those outside
 * the opening hours are discarded with a cheap interval lookup before the
 * full assessment runs, so a month of 5-minute slots costs a few thousand
 * assessments rather than tens of thousands.
 */
export function findAvailableSlots(index: SchedulingIndex, participants = 1): AvailableSlot[] {
  const { service } = index.input;
  const durationMs = service.durationMinutes * MS_PER_MINUTE;
  const slots: AvailableSlot[] = [];
  // Grid minutes inside a spring-forward gap resolve to the first real instant
  // after it, which a later grid minute also names; each instant is offered once.
  let lastCandidate = Number.NEGATIVE_INFINITY;

  for (const date of eachLocalDate(index.range.from, index.range.to)) {
    for (let minute = 0; minute < MINUTES_PER_DAY; minute += service.slotIntervalMinutes) {
      const start = zonedTimeToEpoch(date, minute, index.zone);
      if (start <= lastCandidate || start < index.earliestStart) {
        continue;
      }
      lastCandidate = start;
      if (!listCovers(index.appointmentWindows, { start, end: start + durationMs })) {
        continue;
      }
      const assessment = assessSlot(index, start, participants);
      if (assessment.kind === 'planned') {
        const { slot } = assessment;
        slots.push({
          start: slot.start,
          end: slot.end,
          remainingParticipants: slot.remainingParticipants,
        });
      }
    }
  }
  return slots;
}
