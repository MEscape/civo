import { describe, expect, it } from 'vitest';

import { openDemandOf } from '@modules/booking/domain/scheduling/open-demand';
import type { OpenDemand } from '@modules/booking/domain/scheduling/open-demand';
import { prepareScheduling } from '@modules/booking/domain/scheduling/prepare-scheduling';
import type { ResourceSchedule } from '@modules/booking/domain/scheduling/scheduling-types';
import { findSlots } from '@modules/booking/domain/scheduling/slot-engine';

import { MONDAY, inputOf, need, times, worker } from '../support/scheduling-fixtures';
import { between } from '../support/time-fixtures';

const WORKDAY = between(MONDAY, '09:00', '12:00');
const NINE = between(MONDAY, '09:00', '10:00');
const ELEVEN = between(MONDAY, '11:00', '12:00');

/** The starts a one-hour service with one employee and one room can be booked at, given what waits. */
function startsWith(people: readonly ResourceSchedule[], waiting: readonly OpenDemand[]) {
  const prepared = prepareScheduling({
    ...inputOf({
      open: [WORKDAY],
      rules: { durationMinutes: 60, stepMinutes: 60 },
      requirements: [need(1, ...people), need(1, worker('room', [WORKDAY]))],
    }),
    openDemands: waiting,
  });
  if (prepared.isErr()) {
    throw new Error('the question is out of bounds');
  }
  return times(findSlots(prepared.value));
}

describe('a booking that still waits for an employee', () => {
  it('leaves one fewer of the employees to a booking for the same time', () => {
    const people = [worker('e1', [WORKDAY])];

    expect(startsWith(people, [])).toEqual(['09:00', '10:00', '11:00']);
    expect(startsWith(people, [openDemandOf(NINE, people)])).toEqual(['10:00', '11:00']);
  });

  it('leaves the second of two employees to the new booking', () => {
    const people = [worker('e1', [WORKDAY]), worker('e2', [WORKDAY])];

    expect(startsWith(people, [openDemandOf(NINE, people)])).toEqual(['09:00', '10:00', '11:00']);
  });

  it('holds only the time it is for', () => {
    const people = [worker('e1', [WORKDAY])];

    expect(startsWith(people, [openDemandOf(ELEVEN, people)])).toEqual(['09:00', '10:00']);
  });

  it('does not count a booking whose employees are not the ones asked about', () => {
    const people = [worker('e1', [WORKDAY])];
    const elsewhere = openDemandOf(NINE, [worker('other', [WORKDAY])]);

    expect(elsewhere.candidateIds).toEqual(['other']);
    expect(startsWith(people, [elsewhere])).toEqual(['09:00', '10:00', '11:00']);
  });

  it('can be taken by the employees who are free for all of it', () => {
    const busy = worker('e1', [WORKDAY], [NINE]);
    const free = worker('e2', [WORKDAY]);
    const offHours = worker('e3', [ELEVEN]);

    expect(openDemandOf(NINE, [busy, free, offHours]).candidateIds).toEqual(['e2']);
  });
});
