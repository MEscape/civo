import { describe, expect, it } from 'vitest';

import type { OpenBookingDto } from '@modules/booking/presentation/dto/booking-dto';
import type { MessageDto } from '@modules/booking/presentation/dto/employee-dto';
import { shiftDay } from '@modules/booking/presentation/forms/day-plan';
import { groupByDay } from '@modules/booking/presentation/forms/messages';
import {
  countByTab,
  locationsOf,
  openListHref,
  openListSlice,
} from '@modules/booking/presentation/forms/open-bookings';
import { serviceGroups, toggleId } from '@modules/booking/presentation/forms/preferences';
import {
  parseDayPlanParams,
  parseOpenListParams,
} from '@modules/booking/presentation/schemas/employee-schema';

import { openBooking } from '../support/employee-dtos';

const offers: OpenBookingDto[] = [
  openBooking('a', 'very-good', 'Reisepass'),
  openBooking('b', 'good', 'Meldebescheinigung'),
  openBooking('c', 'possible', 'Wohnsitz anmelden'),
  openBooking('d', 'possible', 'Führungszeugnis'),
];

describe('the open bookings list', () => {
  it('counts the tabs, the two best on their own and the rest together', () => {
    expect(countByTab(offers)).toEqual({ all: 4, 'very-good': 1, good: 1, other: 2 });
  });

  it('shows a tab, searched by service or location, a page at a time', () => {
    const { fit, counts, slice } = openListSlice(offers, { fit: 'other', q: 'wohn' }, 1);
    expect(fit).toBe('other');
    expect(counts.all).toBe(1);
    expect(slice.items.map(({ booking }) => booking.id)).toEqual(['c']);
    expect(slice.total).toBe(1);
  });

  it('keeps every filter in the address of a tab or page, and leaves "all" out', () => {
    const view = { date: '2027-01-14', location: 'loc-1', part: 'morning', q: 'pass' };
    expect(openListHref('/b/me/open', view, { fit: 'all' })).toBe(
      '/b/me/open?date=2027-01-14&location=loc-1&part=morning&q=pass',
    );
    expect(openListHref('/b/me/open', { ...view, fit: 'good' }, { page: 2 })).toContain('fit=good');
  });

  it('offers each location of the list once', () => {
    expect(locationsOf(offers)).toEqual([{ id: 'loc-1', name: 'Bürgerbüro Mitte' }]);
  });

  it('reads the address without trusting it: "any" and unknown values are no filter', () => {
    expect(parseOpenListParams({ location: '*', fit: 'best', part: 'night', q: '' })).toMatchObject(
      {
        location: undefined,
        fit: undefined,
        part: undefined,
        q: undefined,
      },
    );
    expect(parseDayPlanParams({ date: ['2027-01-14', 'x'] })).toEqual({ date: '2027-01-14' });
    expect(parseDayPlanParams({ date: 'tomorrow' })).toEqual({ date: undefined });
  });
});

describe('the day plan', () => {
  it('moves by calendar days, across months and years', () => {
    expect(shiftDay('2027-03-31', 1)).toBe('2027-04-01');
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDay('2027-03-28', 1)).toBe('2027-03-29');
    expect(shiftDay('not a day', 1)).toBe('not a day');
  });
});

describe('the inbox', () => {
  const message = (id: string, day: string): MessageDto => ({
    id,
    type: 'assigned',
    bookingId: `b-${id}`,
    serviceName: 'Reisepass',
    locationName: 'Bürgerbüro Mitte',
    timeZone: 'Europe/Berlin',
    start: `${day}T09:30:00+01:00`,
    createdAt: `${day}T08:15:00+01:00`,
    day,
    isRead: false,
  });

  it('groups by the day a message arrived, today and yesterday by name', () => {
    const groups = groupByDay(
      [
        message('1', '2027-01-14'),
        message('2', '2027-01-14'),
        message('3', '2027-01-13'),
        message('4', '2027-01-02'),
      ],
      { today: '2027-01-14', yesterday: '2027-01-13' },
    );
    expect(groups.map(({ when, items }) => [when, items.length])).toEqual([
      ['today', 2],
      ['yesterday', 1],
      ['earlier', 1],
    ]);
  });
});

describe('the preferences form', () => {
  it('adds a service at the end and takes one out', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('groups services by category with how many are chosen, the search narrowing the rows only', () => {
    const services = [
      { id: 's1', name: 'Personalausweis', category: 'Ausweise' },
      { id: 's2', name: 'Reisepass', category: 'Ausweise' },
      { id: 's3', name: 'Meldebescheinigung', category: null },
    ];
    expect(serviceGroups(services, ['s2'], 'pass')).toEqual([
      { category: 'Ausweise', services: [services[1]], chosen: 1, total: 2 },
    ]);
    expect(serviceGroups(services, [], '')).toHaveLength(2);
  });
});
