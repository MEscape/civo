import { describe, expect, it } from 'vitest';

import { BOOKING_VALIDATION_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import {
  SCHEDULING_LIMITS,
  prepareScheduling,
} from '@modules/booking/domain/scheduling/prepare-scheduling';
import { assessSlot, findSlots } from '@modules/booking/domain/scheduling/slot-engine';
import { asInstant } from '@modules/booking/domain/time/instant';

import {
  MONDAY,
  build,
  inputOf,
  need,
  slotsOf,
  times,
  worker,
} from '../support/scheduling-fixtures';
import { at, between, clock } from '../support/time-fixtures';

import type { Setup } from '../support/scheduling-fixtures';

const WORKDAY = between(MONDAY, '09:00', '12:00');

describe('listing slots without resources', () => {
  it('offers a candidate that fits the opening hours exactly, and none that sticks out', () => {
    const slots = slotsOf({
      open: [WORKDAY],
      rules: { durationMinutes: 60, stepMinutes: 30 },
    });

    expect(times(slots)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
    expect(clock(slots[4]?.end ?? at(MONDAY, '00:00'))).toBe('2027-01-11 12:00');
  });

  it('refuses a candidate that exceeds the opening hours by a single minute', () => {
    const slots = slotsOf({
      open: [between(MONDAY, '09:00', '10:59')],
      rules: { durationMinutes: 65, stepMinutes: 5 },
    });

    expect(times(slots).at(-1)).toBe('09:50');
    expect(slots.at(-1)?.end).toBe(at(MONDAY, '10:55'));
  });

  it('accepts the candidate that ends on the closing minute', () => {
    const slots = slotsOf({
      open: [between(MONDAY, '09:00', '11:00')],
      rules: { durationMinutes: 65, stepMinutes: 5 },
    });

    expect(times(slots).at(-1)).toBe('09:55');
  });

  it('spaces starts by the step, whatever the duration', () => {
    const slots = slotsOf({ open: [WORKDAY], rules: { durationMinutes: 30, stepMinutes: 15 } });

    expect(times(slots)).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      '10:00',
      '10:15',
      '10:30',
      '10:45',
      '11:00',
      '11:15',
      '11:30',
    ]);
  });

  it('counts the grid from local midnight, not from the opening time', () => {
    const slots = slotsOf({
      open: [between(MONDAY, '09:10', '10:00')],
      rules: { durationMinutes: 15, stepMinutes: 15 },
    });

    expect(times(slots)).toEqual(['09:15', '09:30', '09:45']);
  });

  it('is bookable whenever the place is open for a service that needs no resource', () => {
    const slots = slotsOf({
      open: [between(MONDAY, '09:00', '10:00'), between(MONDAY, '13:00', '14:00')],
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });

    expect(times(slots)).toEqual(['09:00', '09:30', '13:00', '13:30']);
  });

  it('has no slot when nothing is open, or the service is longer than any opening window', () => {
    expect(slotsOf({ open: [] })).toEqual([]);
    expect(
      slotsOf({ open: [between(MONDAY, '09:00', '09:45')], rules: { durationMinutes: 60 } }),
    ).toEqual([]);
  });

  it('does not use a window that is split by a minute of closure', () => {
    const open = [between(MONDAY, '09:00', '09:59'), between(MONDAY, '10:00', '11:00')];
    const slots = slotsOf({ open, rules: { durationMinutes: 60, stepMinutes: 30 } });

    expect(times(slots)).toEqual(['10:00']);
  });

  it('uses a window that is made of touching parts as one', () => {
    const open = [between(MONDAY, '09:00', '10:00'), between(MONDAY, '10:00', '11:00')];
    const slots = slotsOf({ open, rules: { durationMinutes: 60, stepMinutes: 30 } });

    expect(times(slots)).toEqual(['09:00', '09:30', '10:00']);
  });
});

describe('listing slots with resources', () => {
  it('needs the resource to work through the whole appointment', () => {
    const slots = slotsOf({
      open: [WORKDAY],
      requirements: [need(1, worker('anna', [between(MONDAY, '09:00', '10:30')]))],
      rules: { durationMinutes: 60, stepMinutes: 30 },
    });

    expect(times(slots)).toEqual(['09:00', '09:30']);
  });

  it('needs the resource to work through the preparation and the clean-up too', () => {
    const slots = slotsOf({
      open: [WORKDAY],
      requirements: [need(1, worker('anna', [WORKDAY]))],
      rules: { durationMinutes: 30, preparationMinutes: 10, cleanupMinutes: 10, stepMinutes: 30 },
    });

    // 09:00 would need the preparation from 08:50; 11:30 would need clean-up until 12:10.
    expect(times(slots)).toEqual(['09:30', '10:00', '10:30', '11:00']);
  });

  it('does not need the buffers to lie inside the opening hours, only the appointment', () => {
    const slots = slotsOf({
      open: [between(MONDAY, '09:00', '10:00')],
      requirements: [need(1, worker('anna', [between(MONDAY, '08:00', '11:00')]))],
      rules: { durationMinutes: 30, preparationMinutes: 30, cleanupMinutes: 30, stepMinutes: 30 },
    });

    expect(times(slots)).toEqual(['09:00', '09:30']);
  });

  it('is blocked by an existing booking, but not by one that merely touches', () => {
    const slots = slotsOf({
      open: [WORKDAY],
      requirements: [need(1, worker('anna', [WORKDAY], [between(MONDAY, '10:00', '11:00')]))],
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });

    expect(times(slots)).toEqual(['09:00', '09:30', '11:00', '11:30']);
  });

  it('is blocked by the clean-up it would need next to an existing booking', () => {
    const slots = slotsOf({
      open: [WORKDAY],
      requirements: [need(1, worker('anna', [WORKDAY], [between(MONDAY, '10:00', '11:00')]))],
      rules: { durationMinutes: 30, cleanupMinutes: 15, stepMinutes: 30 },
    });

    // 09:30 + 30 + 15 reaches 10:15, into the booking; 11:30 + 30 + 15 leaves the working hours.
    expect(times(slots)).toEqual(['09:00', '11:00']);
  });

  it('treats unsorted, overlapping and touching bookings as the one block they form', () => {
    const slots = slotsOf({
      open: [WORKDAY],
      requirements: [
        need(
          1,
          worker(
            'anna',
            [WORKDAY],
            [
              between(MONDAY, '10:30', '11:00'),
              between(MONDAY, '09:30', '10:30'),
              between(MONDAY, '10:00', '10:45'),
            ],
          ),
        ),
      ],
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });

    expect(times(slots)).toEqual(['09:00', '11:00', '11:30']);
  });

  it('is empty when the resource has no availability at all', () => {
    expect(slotsOf({ open: [WORKDAY], requirements: [need(1, worker('anna', []))] })).toEqual([]);
    expect(slotsOf({ open: [WORKDAY], requirements: [need(1)] })).toEqual([]);
  });

  it('needs every requirement to be met at once', () => {
    const slots = slotsOf({
      open: [WORKDAY],
      requirements: [
        need(1, worker('anna', [WORKDAY])),
        need(1, worker('raum', [WORKDAY], [between(MONDAY, '10:00', '10:30')])),
      ],
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });

    expect(times(slots)).toEqual(['09:00', '09:30', '10:30', '11:00', '11:30']);
  });

  it('needs `count` different resources for one requirement', () => {
    const anna = worker('anna', [WORKDAY]);
    const ben = worker('ben', [WORKDAY], [between(MONDAY, '10:00', '10:30')]);
    const carl = worker('carl', [WORKDAY]);

    const two = slotsOf({
      open: [WORKDAY],
      requirements: [need(2, anna, ben)],
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });
    const withSpare = slotsOf({
      open: [WORKDAY],
      requirements: [need(2, anna, ben, carl)],
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });

    expect(times(two)).toEqual(['09:00', '09:30', '10:30', '11:00', '11:30']);
    expect(times(withSpare)).toHaveLength(6);
    expect(withSpare.find((slot) => clock(slot.start).endsWith('10:00'))?.resourceIds).toEqual([
      'anna',
      'carl',
    ]);
  });

  it('uses a resource that two requirements could share only once', () => {
    const anna = worker('anna', [WORKDAY]);
    const ben = worker('ben', [WORKDAY]);

    expect(slotsOf({ open: [WORKDAY], requirements: [need(1, anna), need(1, anna)] })).toEqual([]);

    const [first] = slotsOf({ open: [WORKDAY], requirements: [need(1, anna), need(1, anna, ben)] });
    expect(first?.resourceIds).toEqual(['anna', 'ben']);
  });

  it('counts a resource listed twice in one requirement once', () => {
    const anna = worker('anna', [WORKDAY]);

    expect(slotsOf({ open: [WORKDAY], requirements: [need(2, anna, anna)] })).toEqual([]);
    expect(times(slotsOf({ open: [WORKDAY], requirements: [need(1, anna, anna)] }))).toHaveLength(
      6,
    );
  });

  it('finds the assignment even when the first choice of one requirement is needed by another', () => {
    const anna = worker('anna', [WORKDAY]);
    const ben = worker('ben', [WORKDAY]);
    const [first] = slotsOf({
      open: [WORKDAY],
      requirements: [need(1, anna, ben), need(1, anna)],
    });

    expect(first?.resourceIds).toEqual(['anna', 'ben']);
  });

  it('reports the occupied span, which is wider than the appointment', () => {
    const [first] = slotsOf({
      open: [WORKDAY],
      requirements: [need(1, worker('anna', [WORKDAY]))],
      rules: { durationMinutes: 30, preparationMinutes: 10, cleanupMinutes: 15, stepMinutes: 30 },
    });

    expect(first).toBeDefined();
    expect([
      clock(first?.start ?? at(MONDAY, '00:00')),
      clock(first?.end ?? at(MONDAY, '00:00')),
    ]).toEqual(['2027-01-11 09:30', '2027-01-11 10:00']);
    expect(clock(first?.occupied.start ?? at(MONDAY, '00:00'))).toBe('2027-01-11 09:20');
    expect(clock(first?.occupied.end ?? at(MONDAY, '00:00'))).toBe('2027-01-11 10:15');
  });
});

describe('determinism and order', () => {
  const anna = worker('anna', [WORKDAY], [between(MONDAY, '09:00', '09:30')]);
  const ben = worker('ben', [WORKDAY], [between(MONDAY, '10:00', '10:30')]);
  const carl = worker('carl', [WORKDAY]);

  it('prefers the resource that sorts first by id, whatever order the caller listed them in', () => {
    const forward = slotsOf({ open: [WORKDAY], requirements: [need(1, anna, ben, carl)] });
    const reversed = slotsOf({ open: [WORKDAY], requirements: [need(1, carl, ben, anna)] });

    expect(forward).toEqual(reversed);
    expect(forward.find((slot) => clock(slot.start).endsWith('10:00'))?.resourceIds).toEqual([
      'anna',
    ]);
    expect(forward[0]?.resourceIds).toEqual(['ben']);
  });

  it('gives the same list for the same input, however the windows and bookings are ordered', () => {
    const open = [between(MONDAY, '13:00', '14:00'), WORKDAY];
    const busy = [between(MONDAY, '13:30', '14:00'), between(MONDAY, '10:00', '10:30')];
    const a = slotsOf({
      open,
      requirements: [need(1, worker('x', open, busy), worker('y', open))],
    });
    const b = slotsOf({
      open: [...open].reverse(),
      requirements: [
        need(
          1,
          worker('y', [...open].reverse()),
          worker('x', [...open].reverse(), [...busy].reverse()),
        ),
      ],
    });

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.length).toBeGreaterThan(0);
  });

  it('returns starts earliest first, each once, across several days', () => {
    const open = ['2027-01-11', '2027-01-12', '2027-01-13'].map((date) =>
      between(date, '09:00', '10:00'),
    );
    const slots = slotsOf({
      range: ['2027-01-11', '2027-01-13'],
      open,
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });

    expect(slots.map((slot) => clock(slot.start))).toEqual([
      '2027-01-11 09:00',
      '2027-01-11 09:30',
      '2027-01-12 09:00',
      '2027-01-12 09:30',
      '2027-01-13 09:00',
      '2027-01-13 09:30',
    ]);
    const starts = slots.map((slot) => slot.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(new Set(starts).size).toBe(starts.length);
  });

  it('only lists the days of the range, even where the place is open on other days', () => {
    const open = ['2027-01-11', '2027-01-12'].map((date) => between(date, '09:00', '10:00'));
    const slots = slotsOf({ range: ['2027-01-12', '2027-01-12'], open });

    expect(slots.map((slot) => clock(slot.start).slice(0, 10))).toEqual([
      '2027-01-12',
      '2027-01-12',
    ]);
  });
});

describe('notice and horizon', () => {
  it('lists nothing before now plus the notice', () => {
    const slots = slotsOf({
      open: [WORKDAY],
      now: { date: MONDAY, time: '08:30' },
      noticeMinutes: 60,
    });

    expect(times(slots)).toEqual(['09:30', '10:00', '10:30', '11:00', '11:30']);
  });

  it('lists nothing beyond the last local day of the horizon', () => {
    const open = ['2027-01-11', '2027-01-12', '2027-01-13'].map((date) =>
      between(date, '09:00', '09:30'),
    );
    const slots = slotsOf({
      range: ['2027-01-11', '2027-01-13'],
      open,
      now: { date: '2027-01-11', time: '12:00' },
      horizonDays: 1,
    });

    expect(slots.map((slot) => clock(slot.start))).toEqual(['2027-01-12 09:00']);
  });
});

describe('assessing one start', () => {
  const scheduling = build({
    open: [WORKDAY],
    requirements: [need(1, worker('anna', [WORKDAY], [between(MONDAY, '10:00', '10:30')]))],
    now: { date: MONDAY, time: '08:30' },
    noticeMinutes: 45,
    rules: { durationMinutes: 30, stepMinutes: 30 },
  });

  function reasonAt(time: string): string {
    const assessment = assessSlot(scheduling, at(MONDAY, time));
    return assessment.kind === 'planned' ? 'planned' : assessment.reason;
  }

  it('names the first rule a start breaks, cheapest and most explicable first', () => {
    expect(reasonAt('09:10')).toBe('off-grid');
    expect(reasonAt('09:00')).toBe('outside-start-window');
    expect(reasonAt('12:30')).toBe('outside-open-hours');
    expect(reasonAt('10:00')).toBe('resources-unavailable');
    expect(reasonAt('09:30')).toBe('planned');
  });

  it('refuses an instant that is not on a whole minute of the grid', () => {
    const slightlyLate = asInstant(at(MONDAY, '09:30') + 1_000);
    expect(assessSlot(scheduling, slightlyLate)).toEqual({ kind: 'rejected', reason: 'off-grid' });
  });

  it('agrees with the list for every minute of the day', () => {
    const listed = new Map(findSlots(scheduling).map((slot) => [slot.start, slot]));
    const day0 = at(MONDAY, '00:00');

    for (let minute = 0; minute < 24 * 60; minute += 1) {
      const start = asInstant(day0 + minute * 60_000);
      const assessment = assessSlot(scheduling, start);
      expect(assessment.kind === 'planned').toBe(listed.has(start));
      if (assessment.kind === 'planned') {
        expect(assessment.slot).toEqual(listed.get(start));
      }
    }
  });
});

describe('bounds and invalid input', () => {
  function errorsOf(setup: Setup) {
    const result = prepareScheduling(inputOf(setup));
    return result.isErr() ? result.error.fieldErrors : {};
  }

  it('refuses a range longer than a scheduling question may cover', () => {
    expect(errorsOf({ open: [], range: ['2027-01-01', '2027-03-04'] })).toEqual({
      range: [CODES.dateRangeTooLong],
    });
    expect(
      prepareScheduling(inputOf({ open: [], range: ['2027-01-01', '2027-03-03'] })).isOk(),
    ).toBe(true);
  });

  it('refuses too many requirements, a count out of bounds and too many resources', () => {
    const anna = worker('anna', [WORKDAY]);
    expect(
      errorsOf({
        open: [],
        requirements: Array.from({ length: SCHEDULING_LIMITS.maxRequirements + 1 }, () =>
          need(1, anna),
        ),
      }),
    ).toEqual({ requirements: [CODES.tooMany] });
    expect(errorsOf({ open: [], requirements: [need(0, anna)] })).toEqual({
      'requirements.0.count': [CODES.requirementCountInvalid],
    });
    expect(errorsOf({ open: [], requirements: [need(1, anna), need(21, anna)] })).toEqual({
      'requirements.1.count': [CODES.requirementCountInvalid],
    });
    expect(errorsOf({ open: [], requirements: [need(1.5, anna)] })).toEqual({
      'requirements.0.count': [CODES.requirementCountInvalid],
    });
    const crowd = Array.from({ length: SCHEDULING_LIMITS.maxResourcesPerRequirement + 1 }, (_, i) =>
      worker(`r${i}`, [WORKDAY]),
    );
    expect(errorsOf({ open: [], requirements: [need(1, ...crowd)] })).toEqual({
      'requirements.0.resources': [CODES.tooMany],
    });
  });

  it('copes with a month of five-minute slots and a real pool within a second or two', () => {
    const month = Array.from({ length: 31 }, (_, index) =>
      between(`2027-01-${String(index + 1).padStart(2, '0')}`, '08:00', '18:00'),
    );
    const pool = (prefix: string) =>
      Array.from({ length: 10 }, (_, index) =>
        worker(`${prefix}${index}`, month, [between('2027-01-11', '10:00', '10:30')]),
      );
    const startedAt = performance.now();

    const slots = slotsOf({
      range: ['2027-01-01', '2027-01-31'],
      open: month,
      requirements: [need(1, ...pool('staff')), need(1, ...pool('room'))],
      rules: { durationMinutes: 30, preparationMinutes: 5, cleanupMinutes: 5, stepMinutes: 5 },
    });

    expect(slots.length).toBeGreaterThan(31 * 100);
    expect(performance.now() - startedAt).toBeLessThan(5000);
  });
});
