import { prepareScheduling } from '@modules/booking/domain/scheduling/prepare-scheduling';
import type {
  PlannedSlot,
  ResourceRequirement,
  ResourceSchedule,
  Scheduling,
  SchedulingInput,
} from '@modules/booking/domain/scheduling/scheduling-types';
import { findSlots } from '@modules/booking/domain/scheduling/slot-engine';
import type { SlotRulesInput } from '@modules/booking/domain/scheduling/slot-rules';
import { createStartWindow } from '@modules/booking/domain/scheduling/start-window';
import { createLocalDateRange } from '@modules/booking/domain/time/local-date-range';
import type { TimeInterval } from '@modules/booking/domain/time/time-interval';
import type { TimeZone } from '@modules/booking/domain/time/time-zone';

import { BERLIN, at, clock, day, rulesOf, unwrap } from '../support/time-fixtures';

/** Helpers for questions put to the scheduling engine on one Monday in Berlin. */
export const MONDAY = '2027-01-11';

export interface Setup {
  readonly range?: readonly [string, string];
  readonly rules?: Partial<SlotRulesInput>;
  readonly open: readonly TimeInterval[];
  readonly requirements?: readonly ResourceRequirement[];
  readonly now?: { readonly date: string; readonly time: string };
  readonly noticeMinutes?: number;
  readonly horizonDays?: number;
  readonly zone?: TimeZone;
}

export function inputOf(setup: Setup): SchedulingInput {
  const zone = setup.zone ?? BERLIN;
  const [from, to] = setup.range ?? [MONDAY, MONDAY];
  const range = createLocalDateRange(day(from), day(to), 400);
  if (range === null) {
    throw new Error('fixture: range');
  }
  const now = setup.now ?? { date: '2027-01-01', time: '08:00' };
  return {
    zone,
    range,
    rules: rulesOf(setup.rules),
    startWindow: unwrap(
      createStartWindow({
        now: at(now.date, now.time, zone),
        zone,
        noticeMinutes: setup.noticeMinutes ?? 0,
        horizonDays: setup.horizonDays ?? 365,
      }),
    ),
    openWindows: setup.open,
    requirements: setup.requirements ?? [],
  };
}

export function build(setup: Setup): Scheduling {
  return unwrap(prepareScheduling(inputOf(setup)));
}

export function slotsOf(setup: Setup): PlannedSlot[] {
  return findSlots(build(setup));
}

/** The start times as wall-clock `HH:mm`, for a single-day question. */
export function times(slots: readonly PlannedSlot[], zone: TimeZone = BERLIN): string[] {
  return slots.map((slot) => clock(slot.start, zone).slice(-5));
}

export function worker(
  id: string,
  availability: readonly TimeInterval[],
  busy: readonly TimeInterval[] = [],
): ResourceSchedule {
  return { id, availability, busy };
}

export function need(count: number, ...resources: ResourceSchedule[]): ResourceRequirement {
  return { count, resources };
}
