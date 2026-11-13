import { describe, expect, it } from 'vitest';

import { openDemandsOf } from '@modules/booking/application/services/open-demands';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type { StoredBooking } from '@modules/booking/domain/ports/booking.repository';
import type { ResourceSchedule } from '@modules/booking/domain/scheduling/scheduling-types';
import { asInstant } from '@modules/booking/domain/time/instant';

const span = { start: asInstant(1_000), end: asInstant(2_000) };
const LOCATION = 'loc-1';

const employee = (id: string, skills: string[] = []) =>
  ({
    id,
    type: 'employee',
    skills,
    isActive: true,
    locationId: LOCATION,
    capacity: null,
  }) as unknown as BookableResource;

const free = (id: string): ResourceSchedule => ({ id, availability: [span], busy: [] });

function waiting(
  units: Array<{ resourceId: string | null; type?: string }>,
  skills: string[] = [],
  hasSnapshot = true,
): StoredBooking {
  return {
    booking: {
      locationId: LOCATION,
      assignments: units.map((unit) => ({
        requirementIndex: 0,
        resourceType: unit.type ?? 'employee',
        resourceId: unit.resourceId,
        occupied: span,
      })),
    },
    placement: {
      snapshot: hasSnapshot
        ? {
            requirements: [{ resourceType: 'employee', skills, count: 1, resourceIds: null }],
          }
        : null,
    },
  } as unknown as StoredBooking;
}

const team = {
  employees: [employee('e1', ['passport']), employee('e2')],
  schedules: new Map([
    ['e1', free('e1')],
    ['e2', free('e2')],
  ]),
};

describe('what the bookings that wait for an employee will ask of the team', () => {
  it('is the employees who hold the qualification the booking was made for', () => {
    expect(openDemandsOf([waiting([{ resourceId: null }], ['passport'])], team)).toEqual([
      { span, candidateIds: ['e1'] },
    ]);
  });

  it('is every employee when the service asks for no qualification', () => {
    expect(openDemandsOf([waiting([{ resourceId: null }])], team)[0]?.candidateIds).toEqual([
      'e1',
      'e2',
    ]);
  });

  it('counts each open unit, and leaves out a unit that has its employee', () => {
    const open = waiting([{ resourceId: null }, { resourceId: 'e2' }, { resourceId: null }]);

    expect(openDemandsOf([open], team)).toHaveLength(2);
  });

  it('leaves out units of rooms, which are always held', () => {
    expect(openDemandsOf([waiting([{ resourceId: null, type: 'room' }])], team)).toEqual([]);
  });

  it('counts for nothing when the booking kept no requirements to read the qualification from', () => {
    expect(openDemandsOf([waiting([{ resourceId: null }], [], false)], team)).toEqual([]);
  });
});
