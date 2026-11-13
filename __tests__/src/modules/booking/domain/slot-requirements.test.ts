import { describe, expect, it } from 'vitest';

import { prepareScheduling } from '@modules/booking/domain/scheduling/prepare-scheduling';
import type { ResourceRequirement } from '@modules/booking/domain/scheduling/scheduling-types';
import { assessSlot, findSlots } from '@modules/booking/domain/scheduling/slot-engine';
import { createStartWindow } from '@modules/booking/domain/scheduling/start-window';
import { createLocalDateRange } from '@modules/booking/domain/time/local-date-range';

import { MONDAY, NOW, WORKDAY, schedule } from '../support/booking-fixtures';
import { BERLIN, at, day, rulesOf, unwrap } from '../support/time-fixtures';

function planned(requirements: ResourceRequirement[]) {
  const range = createLocalDateRange(day(MONDAY), day(MONDAY), 62);
  if (range === null) {
    throw new Error('fixture');
  }
  const scheduling = unwrap(
    prepareScheduling({
      zone: BERLIN,
      range,
      rules: rulesOf(),
      startWindow: unwrap(
        createStartWindow({ now: NOW, zone: BERLIN, noticeMinutes: 0, horizonDays: 30 }),
      ),
      openWindows: [WORKDAY],
      requirements,
    }),
  );
  const assessment = assessSlot(scheduling, at(MONDAY, '10:00'));
  if (assessment.kind !== 'planned') {
    throw new Error(`fixture: ${assessment.reason}`);
  }
  return {
    slot: assessment.slot,
    listed: findSlots(scheduling).find((slot) => slot.start === assessment.slot.start),
  };
}

describe('which resource serves which requirement', () => {
  const anna = schedule('anna', [WORKDAY]);
  const ben = schedule('ben', [WORKDAY]);
  const room = schedule('room-1', [WORKDAY]);

  it('groups the chosen resources by requirement, in the order the requirements were given', () => {
    const { slot } = planned([
      { count: 1, resources: [room] },
      { count: 1, resources: [anna, ben] },
    ]);

    expect(slot.requirementResourceIds).toEqual([['room-1'], ['anna']]);
    expect(slot.resourceIds).toEqual(['anna', 'room-1']);
  });

  it('gives one id per unit of a requirement that needs several', () => {
    const { slot } = planned([{ count: 2, resources: [ben, anna] }]);
    expect(slot.requirementResourceIds).toEqual([['anna', 'ben']]);
  });

  it('is empty for a service that needs no resource, and is the same in the list and in the assessment', () => {
    const { slot, listed } = planned([]);
    expect(slot.requirementResourceIds).toEqual([]);
    expect(listed).toEqual(slot);
  });
});
