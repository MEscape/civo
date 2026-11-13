import { describe, expect, it } from 'vitest';

import { whyNoSlots } from '@modules/booking/application/services/slot-emptiness';
import type { Scheduling } from '@modules/booking/domain/scheduling/scheduling-types';
import { parseLocalDate } from '@modules/booking/domain/time/local-date';

const HOUR = 3_600_000;
// 2027-01-12 08:00 UTC is 09:00 in Berlin: the same calendar day.
const MORNING = Date.UTC(2027, 0, 12, 8);

function scheduling(overrides: Partial<Scheduling>): Scheduling {
  return {
    zone: 'Europe/Berlin',
    range: { from: parseLocalDate('2027-01-12'), to: parseLocalDate('2027-01-12') },
    rules: {},
    startWindow: {},
    openWindows: [{ start: MORNING, end: MORNING + 4 * HOUR }],
    pools: [{ count: 1, resources: [{ id: 'e1', availability: [], busy: [] }] }],
    ...overrides,
  } as unknown as Scheduling;
}

describe('why a day offers no start', () => {
  it('says the place is closed when nothing is open that day', () => {
    expect(
      whyNoSlots(scheduling({ openWindows: [] }), [{ resourceType: 'employee' } as never]),
    ).toBe('closed');
  });

  it('says nobody has a calendar when the employee the service needs does not exist', () => {
    const empty = scheduling({ pools: [{ count: 1, resources: [] }] });
    expect(whyNoSlots(empty, [{ resourceType: 'employee' } as never])).toBe('no-employee');
  });

  it('says a resource is missing when it is a room that is not there', () => {
    const empty = scheduling({ pools: [{ count: 1, resources: [] }] });
    expect(whyNoSlots(empty, [{ resourceType: 'room' } as never])).toBe('no-resource');
  });

  it('says everything is taken when all the needed things exist', () => {
    expect(whyNoSlots(scheduling({}), [{ resourceType: 'employee' } as never])).toBe(
      'fully-booked',
    );
  });
});
