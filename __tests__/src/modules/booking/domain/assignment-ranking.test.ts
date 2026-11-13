import { describe, expect, it } from 'vitest';

import { assessCandidates } from '@modules/booking/domain/assignment/assignment-eligibility';
import { assessFit } from '@modules/booking/domain/assignment/assignment-fit';
import type { FitSubject } from '@modules/booking/domain/assignment/assignment-fit';
import {
  compareFit,
  rankBookings,
  rankCandidates,
} from '@modules/booking/domain/assignment/assignment-ranking';
import type { EmployeePreferences } from '@modules/booking/domain/models/employee-preferences';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingId,
} from '@modules/booking/domain/models/ids';
import type { BookableResourceId } from '@modules/booking/domain/models/ids';
import { createTimeRange } from '@modules/booking/domain/scheduling/weekly-hours';

import {
  NOW,
  MONDAY,
  SERVICE_ID,
  WORKDAY,
  employee,
  makeBooking,
  schedule,
  unitOf,
} from '../support/booking-fixtures';
import { BERLIN, at, between } from '../support/time-fixtures';

const OTHER_SERVICE = toBookableServiceId('svc-vehicle');
const SUBJECT: FitSubject = {
  serviceId: SERVICE_ID,
  appointment: between(MONDAY, '10:00', '10:30'),
  zone: BERLIN,
};

function window(from: number, to: number) {
  const range = createTimeRange(from, to);
  if (range === null) {
    throw new Error('fixture: window');
  }
  return range;
}

function preferences(overrides: Partial<EmployeePreferences> = {}): EmployeePreferences {
  return { serviceIds: [], window: null, ...overrides };
}

const MORNING = window(6 * 60, 13 * 60);
const AFTERNOON = window(13 * 60, 18 * 60);

describe('how well a booking fits', () => {
  it('is very good when everything the employee said fits: the service and the time', () => {
    const fit = assessFit(preferences({ serviceIds: [SERVICE_ID], window: MORNING }), SUBJECT);

    expect(fit.level).toBe('very-good');
    expect(fit.reasons).toEqual(['service-preferred', 'time-in-window']);
  });

  it('is good when some of it fits: the service or the time, not both', () => {
    const wrongService = assessFit(
      preferences({ serviceIds: [OTHER_SERVICE], window: MORNING }),
      SUBJECT,
    );
    const wrongTime = assessFit(
      preferences({ serviceIds: [SERVICE_ID], window: AFTERNOON }),
      SUBJECT,
    );

    expect(wrongService.level).toBe('good');
    expect(wrongService.reasons).toEqual(['service-not-preferred', 'time-in-window']);
    expect(wrongTime.level).toBe('good');
    expect(wrongTime.reasons).toEqual(['service-preferred', 'time-outside-window']);
  });

  it('is possible when nothing fits, and for an employee who set no preferences', () => {
    const none = assessFit(
      preferences({ serviceIds: [OTHER_SERVICE], window: AFTERNOON }),
      SUBJECT,
    );
    expect(none.level).toBe('possible');
    expect(none.reasons).toEqual(['service-not-preferred', 'time-outside-window']);

    expect(assessFit(null, SUBJECT)).toMatchObject({ level: 'possible', reasons: [] });
    expect(assessFit(preferences(), SUBJECT).level).toBe('possible');
  });

  it('does not count a dimension against the employee where they said nothing about it', () => {
    const serviceOnly = assessFit(preferences({ serviceIds: [SERVICE_ID] }), SUBJECT);
    expect(serviceOnly.level).toBe('very-good');
    expect(serviceOnly.reasons).toEqual(['service-preferred']);
  });

  it('puts the appointment inside the window including both boundaries, and not a minute outside', () => {
    const fits = (from: number, to: number) =>
      assessFit(preferences({ window: window(from, to) }), SUBJECT).isTimeInWindow;

    expect(fits(600, 630)).toBe(true);
    expect(fits(599, 631)).toBe(true);
    expect(fits(600, 629)).toBe(false);
    expect(fits(601, 700)).toBe(false);
  });

  it('reads the window on the wall clock of the location, also across midnight and the clock change', () => {
    const lateEvening = { ...SUBJECT, appointment: between(MONDAY, '23:30', '24:00') };
    expect(
      assessFit(preferences({ window: window(23 * 60, 1440) }), lateEvening).isTimeInWindow,
    ).toBe(true);
    expect(
      assessFit(preferences({ window: window(23 * 60, 1439) }), lateEvening).isTimeInWindow,
    ).toBe(false);

    const overMidnight = {
      ...SUBJECT,
      appointment: { start: at(MONDAY, '23:45'), end: at('2027-01-12', '00:15') },
    };
    expect(assessFit(preferences({ window: window(0, 1440) }), overMidnight).isTimeInWindow).toBe(
      false,
    );

    // 01:30 to 03:30 on the wall clock is two elapsed hours on the day the clocks jump at 02:00.
    const springDay = {
      ...SUBJECT,
      appointment: { start: at('2027-03-28', '01:30'), end: at('2027-03-28', '03:30') },
    };
    expect(assessFit(preferences({ window: window(60, 4 * 60) }), springDay).isTimeInWindow).toBe(
      true,
    );
  });

  it('puts the fits in order: level, then service, then time', () => {
    const both = assessFit(preferences({ serviceIds: [SERVICE_ID], window: MORNING }), SUBJECT);
    const wrongTime = assessFit(
      preferences({ serviceIds: [SERVICE_ID], window: AFTERNOON }),
      SUBJECT,
    );
    const serviceOnly = assessFit(preferences({ serviceIds: [SERVICE_ID] }), SUBJECT);
    const timeOnly = assessFit(preferences({ window: MORNING }), SUBJECT);

    expect(compareFit(both, wrongTime)).toBeLessThan(0);
    expect(compareFit(wrongTime, both)).toBeGreaterThan(0);
    // Both are very good; the service counts before the time.
    expect(compareFit(serviceOnly, timeOnly)).toBeLessThan(0);
    expect(compareFit(both, both)).toBe(0);
  });
});

describe('ranking the candidates for a booking', () => {
  const booking = makeBooking({ assignments: [unitOf(null)] });
  const requirement = {
    resourceType: 'employee',
    skills: ['ausweise'],
    count: 1,
    resourceIds: null,
  } as const;

  function partition(ids: string[], blocked: string[] = []) {
    return assessCandidates({
      now: NOW,
      booking,
      requirement,
      requirementIndex: 0,
      candidates: ids.map((id) => ({
        resource: employee(id),
        schedule: schedule(
          id,
          [WORKDAY],
          blocked.includes(id) ? [between(MONDAY, '10:00', '10:30')] : [],
        ),
      })),
    });
  }

  function mapOf(
    entries: Record<string, EmployeePreferences>,
  ): ReadonlyMap<BookableResourceId, EmployeePreferences> {
    return new Map(Object.entries(entries).map(([id, value]) => [toBookableResourceId(id), value]));
  }

  const PREFERENCES = mapOf({
    ben: preferences({ serviceIds: [SERVICE_ID], window: MORNING }),
    carl: preferences({ serviceIds: [SERVICE_ID], window: AFTERNOON }),
    dora: preferences({ serviceIds: [OTHER_SERVICE] }),
  });

  it('puts the best fit first: very good, good, possible', () => {
    const { eligible } = partition(['anna', 'dora', 'carl', 'ben']);
    const ranked = rankCandidates({
      candidates: eligible,
      preferences: PREFERENCES,
      subject: SUBJECT,
    });

    expect(ranked.map((entry) => [entry.candidate.resource.id, entry.fit.level])).toEqual([
      ['ben', 'very-good'],
      ['carl', 'good'],
      ['anna', 'possible'],
      ['dora', 'possible'],
    ]);
  });

  it('breaks a tie by resource id, and gives the same order however the input is ordered', () => {
    const { eligible } = partition(['erik', 'anna', 'frida', 'bea']);
    const forward = rankCandidates({
      candidates: eligible,
      preferences: new Map(),
      subject: SUBJECT,
    });
    const backward = rankCandidates({
      candidates: [...eligible].reverse(),
      preferences: new Map(),
      subject: SUBJECT,
    });

    expect(forward.map((entry) => entry.candidate.resource.id)).toEqual([
      'anna',
      'bea',
      'erik',
      'frida',
    ]);
    expect(backward).toEqual(forward);
  });

  it('only orders: nobody is added or dropped, and a candidate with no preferences stays on the list', () => {
    const { eligible } = partition(['anna', 'ben', 'carl']);
    const ranked = rankCandidates({
      candidates: eligible,
      preferences: PREFERENCES,
      subject: SUBJECT,
    });

    expect(ranked).toHaveLength(eligible.length);
    expect(ranked.map((entry) => entry.candidate.resource.id).sort()).toEqual([
      'anna',
      'ben',
      'carl',
    ]);
  });

  it('never sees an ineligible resource, however well it would fit', () => {
    // Ben fits best of all, but he is busy: he is not eligible, so ranking cannot bring him back.
    const { eligible, ineligible } = partition(['anna', 'ben', 'carl'], ['ben']);
    const ranked = rankCandidates({
      candidates: eligible,
      preferences: PREFERENCES,
      subject: SUBJECT,
    });

    expect(ineligible.map((entry) => entry.resourceId)).toEqual(['ben']);
    expect(ranked.map((entry) => entry.candidate.resource.id)).toEqual(['carl', 'anna']);
  });
});

describe('ranking the open bookings for an employee', () => {
  const morning = makeBooking({
    id: toBookingId('b-morning'),
    start: at(MONDAY, '09:00'),
    end: at(MONDAY, '09:30'),
    assignments: [unitOf(null)],
  });
  const noon = makeBooking({
    id: toBookingId('b-noon'),
    start: at(MONDAY, '12:00'),
    end: at(MONDAY, '12:30'),
    assignments: [unitOf(null)],
  });
  const otherService = makeBooking({
    id: toBookingId('b-other'),
    serviceId: OTHER_SERVICE,
    start: at(MONDAY, '08:00'),
    end: at(MONDAY, '08:30'),
    assignments: [unitOf(null)],
  });
  const twin = makeBooking({
    id: toBookingId('b-twin'),
    start: at(MONDAY, '09:00'),
    end: at(MONDAY, '09:30'),
    assignments: [unitOf(null)],
  });

  function entries(bookings: Array<ReturnType<typeof makeBooking>>) {
    return bookings.map((booking) => ({ booking, zone: BERLIN }));
  }

  it('lists the preferred service first, then the earliest start, then the id', () => {
    const ranked = rankBookings({
      bookings: entries([otherService, noon, twin, morning]),
      preferences: preferences({ serviceIds: [SERVICE_ID] }),
    });

    expect(ranked.map((entry) => entry.booking.id)).toEqual([
      'b-morning',
      'b-twin',
      'b-noon',
      'b-other',
    ]);
    expect(ranked.map((entry) => entry.fit.level)).toEqual([
      'very-good',
      'very-good',
      'very-good',
      'possible',
    ]);
  });

  it('keeps every booking on the list, and is the same whatever order they came in', () => {
    const all = entries([otherService, noon, twin, morning]);
    const input = { preferences: preferences({ serviceIds: [SERVICE_ID] }) };

    const forward = rankBookings({ ...input, bookings: all });
    const backward = rankBookings({ ...input, bookings: [...all].reverse() });

    expect(forward).toHaveLength(4);
    expect(backward).toEqual(forward);
  });

  it('is a plain list by time for an employee with no preferences', () => {
    const ranked = rankBookings({
      bookings: entries([noon, morning, otherService]),
      preferences: null,
    });
    expect(ranked.map((entry) => entry.booking.id)).toEqual(['b-other', 'b-morning', 'b-noon']);
  });
});
