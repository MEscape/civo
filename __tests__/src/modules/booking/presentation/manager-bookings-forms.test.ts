import { describe, expect, it } from 'vitest';

import { bookingListHref } from '@modules/booking/presentation/forms/booking-list-href';
import { calendarDays, shiftAnchor } from '@modules/booking/presentation/forms/calendar-range';
import {
  parseBookingListParams,
  parseCalendarParams,
} from '@modules/booking/presentation/schemas/parse-booking-list-input';

describe('the days a calendar view shows', () => {
  it('starts a week on Monday, and a month on the Monday of its grid, six weeks long', () => {
    // 2027-01-14 is a Thursday.
    expect(calendarDays('day', '2027-01-14')).toEqual({ from: '2027-01-14', to: '2027-01-14' });
    expect(calendarDays('week', '2027-01-14')).toEqual({ from: '2027-01-11', to: '2027-01-17' });
    expect(calendarDays('list', '2027-01-17')).toEqual({ from: '2027-01-11', to: '2027-01-17' });
    expect(calendarDays('month', '2027-01-14')).toEqual({ from: '2026-12-28', to: '2027-02-07' });
  });

  it('keeps a week across the change to summer time at seven days', () => {
    // The clocks change on Sunday 2027-03-28 in Europe; whole days do not care.
    expect(calendarDays('week', '2027-03-28')).toEqual({ from: '2027-03-22', to: '2027-03-28' });
  });

  it('steps by the period shown', () => {
    expect(shiftAnchor('day', '2027-01-31', 1)).toBe('2027-02-01');
    expect(shiftAnchor('week', '2027-01-14', -1)).toBe('2027-01-07');
    expect(shiftAnchor('month', '2027-01-31', 1)).toBe('2027-02-01');
    expect(shiftAnchor('month', '2027-01-14', -1)).toBe('2026-12-01');
  });
});

describe('the address of the bookings list', () => {
  it('reads what fits and drops what does not, never failing', () => {
    expect(
      parseBookingListParams({
        from: '2027-01-12',
        to: 'tomorrow',
        state: ['open', 'held'],
        location: '*',
        q: ' 7kq3 ',
        booking: 'b-1',
        page: '2',
      }),
    ).toEqual({
      from: '2027-01-12',
      to: undefined,
      state: 'open',
      locationId: undefined,
      serviceId: undefined,
      resourceId: undefined,
      reference: '7kq3',
      bookingId: 'b-1',
      page: { page: '2', pageSize: undefined },
    });
    expect(parseCalendarParams({ view: 'year' })).toMatchObject({ view: 'week', date: undefined });
  });

  it('keeps the filters in every link and starts a new state on its first page', () => {
    const view = {
      from: '2027-01-12',
      to: '2027-01-12',
      state: undefined,
      locationId: 'loc-1',
      serviceId: undefined,
      resourceId: undefined,
      reference: undefined,
      page: 2,
      pageSize: 25,
      bookingId: 'b-1',
    };
    expect(bookingListHref('/list', view, { page: 3 })).toBe(
      '/list?from=2027-01-12&to=2027-01-12&location=loc-1&booking=b-1&page=3&pageSize=25',
    );
    expect(bookingListHref('/list', view, { state: 'open', bookingId: null })).toBe(
      '/list?from=2027-01-12&to=2027-01-12&state=open&location=loc-1&pageSize=25',
    );
    expect(bookingListHref('/list', view, { bookingId: null })).toBe(
      '/list?from=2027-01-12&to=2027-01-12&location=loc-1&page=2&pageSize=25',
    );
  });
});
