import { describe, expect, it } from 'vitest';

import type { BookingCatalogDto, CatalogServiceDto } from '@modules/booking/client';
import { initialMonthOf } from '@modules/booking/presentation/forms/initial-month';
import {
  initialJourney,
  journeyReducer,
  previousOf,
  stepsOf,
} from '@modules/booking/presentation/forms/journey-state';
import {
  dayAfter,
  daysOfMonth,
  firstColumnOf,
  freeDaysOf,
  monthSpan,
  shiftMonth,
} from '@modules/booking/presentation/forms/month-calendar';

const service = (id: string, locationIds: string[]): CatalogServiceDto => ({
  id,
  name: id,
  description: null,
  category: null,
  instructions: null,
  requiredDocuments: [],
  durationMinutes: 30,
  horizonDays: 30,
  information: [],
  cancellation: { isAllowed: true, deadlineMinutes: 0 },
  rescheduling: { isAllowed: true, deadlineMinutes: 0 },
  locationIds,
});
const place = (id: string) => ({
  id,
  name: id,
  address: null,
  timeZone: 'Europe/Berlin',
  today: '2027-03-30',
});
const catalogOf = (...services: CatalogServiceDto[]): BookingCatalogDto => ({
  isTruncated: false,
  services,
  locations: [place('a'), place('b')],
});

describe('the steps of the journey', () => {
  it('skips a choice with only one answer', () => {
    const two = catalogOf(service('s1', ['a', 'b']), service('s2', ['a']));
    const one = catalogOf(service('s1', ['a']));

    expect(stepsOf(two, null)).toEqual([
      'service',
      'location',
      'date',
      'time',
      'details',
      'review',
      'done',
    ]);
    expect(stepsOf(two, two.services[1] ?? null)).not.toContain('location');
    expect(initialJourney(one)).toMatchObject({ step: 'date', serviceId: 's1', locationId: 'a' });
    expect(previousOf(stepsOf(one, one.services[0] ?? null), 'date')).toBeNull();
  });

  it('keeps what the visitor typed when their time is lost, and forgets the reservation', () => {
    const start = initialJourney(catalogOf(service('s1', ['a'])));
    const typed = journeyReducer(start, {
      type: 'details',
      details: { email: 'mira@example.org' },
    });
    const lost = journeyReducer(typed, { type: 'lost', notice: 'hold-expired' });

    expect(lost).toMatchObject({
      step: 'time',
      hold: null,
      times: null,
      notice: 'hold-expired',
      details: { email: 'mira@example.org' },
    });
  });

  it('opens the calendar at the month of the location’s today, from today', () => {
    expect(initialMonthOf(catalogOf(service('s1', ['a'])))).toEqual({
      month: '2027-03',
      request: { serviceId: 's1', locationId: 'a', from: '2027-03-30', to: '2027-03-31' },
    });
    expect(initialMonthOf(catalogOf(service('s1', ['a', 'b'])))).toBeNull();
  });
});

describe('the calendar arithmetic', () => {
  it('counts days and months without a zone, across a leap day and a clock change', () => {
    expect(daysOfMonth('2028-02')).toHaveLength(29);
    expect(firstColumnOf('2027-01')).toBe(5); // a Friday
    expect(firstColumnOf('2027-02')).toBe(1); // a Monday
    expect(shiftMonth('2027-12', 1)).toBe('2028-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(dayAfter('2027-03-27', 2)).toBe('2027-03-29');
    expect(monthSpan('2027-03', '2027-03-30')).toEqual({ from: '2027-03-30', to: '2027-03-31' });
    expect(monthSpan('2027-02', '2027-03-30')).toBeNull();
  });

  it('leaves the days after a cut-short answer open to choose', () => {
    const slots = [{ start: '2027-03-29T09:00:00+02:00' }, { start: '2027-03-29T09:30:00+02:00' }];

    expect(freeDaysOf('2027-03', { slots, isTruncated: false })).toEqual(['2027-03-29']);
    expect(freeDaysOf('2027-03', { slots, isTruncated: true })).toEqual([
      '2027-03-29',
      '2027-03-30',
      '2027-03-31',
    ]);
  });
});
