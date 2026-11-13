import { assert, describe, expect, it } from 'vitest';

import { daySpan, nextOf, phaseOf } from '@modules/booking/application/services/day-plan';
import {
  isOnDay,
  parseOpenFilter,
} from '@modules/booking/application/services/open-booking-filter';
import { parsePreferences } from '@modules/booking/application/services/parse-preferences';

import { MS_PER_MINUTE } from '@lib/utils';

import { MONDAY, makeBooking } from '../support/booking-fixtures';
import { BERLIN, at, day, unwrap } from '../support/time-fixtures';

const nineAm = makeBooking({ start: at(MONDAY, '09:00'), end: at(MONDAY, '09:30') });

describe('the day plan’s clock', () => {
  it('says where a booking stands: done and no-show as recorded, the rest from now (half-open)', () => {
    expect(phaseOf({ ...nineAm, status: 'completed' }, at(MONDAY, '08:00'))).toBe('done');
    expect(phaseOf({ ...nineAm, status: 'no_show' }, at(MONDAY, '10:00'))).toBe('missed');
    expect(phaseOf(nineAm, at(MONDAY, '08:59'))).toBe('upcoming');
    expect(phaseOf(nineAm, at(MONDAY, '09:00'))).toBe('now');
    expect(phaseOf(nineAm, at(MONDAY, '09:30'))).toBe('past');
  });

  it('names the next confirmed booking that has not started, minutes rounded up', () => {
    const later = makeBooking({
      id: nineAm.id.replace('1', '2') as typeof nineAm.id,
      start: at(MONDAY, '11:00'),
      end: at(MONDAY, '11:30'),
    });
    expect(nextOf([later, nineAm], at(MONDAY, '08:47'))).toEqual({
      bookingId: nineAm.id,
      minutesUntil: 13,
    });
    expect(nextOf([nineAm, { ...later, status: 'completed' }], at(MONDAY, '09:10'))).toBeNull();
  });

  it('makes a day 23 hours long when the clocks go forward', () => {
    const springForward = day('2027-03-28');
    const span = daySpan(springForward, BERLIN);
    expect(span.end - span.start).toBe(23 * 60 * MS_PER_MINUTE);
  });
});

describe('filters of the open bookings', () => {
  it('reads a day, a location and a part of the day, and refuses a day that is not one', () => {
    expect(parseOpenFilter({ websiteId: 'tenant-1', date: '2027-02-30' })).toBeNull();
    expect(parseOpenFilter({ websiteId: 'tenant-1', locationId: '' })).toBeNull();
    const filter = parseOpenFilter({ websiteId: 'tenant-1', date: MONDAY, partOfDay: 'morning' });
    assert(filter !== null);
    expect(isOnDay(nineAm, BERLIN, filter)).toBe(true);
    expect(isOnDay(nineAm, BERLIN, { ...filter, partOfDay: 'afternoon' })).toBe(false);
    expect(isOnDay(nineAm, BERLIN, { ...filter, date: undefined, partOfDay: undefined })).toBe(
      true,
    );
    // Half past midnight UTC is the next day in Berlin: the day is the location's.
    const lateUtc = makeBooking({
      start: at('2027-01-11', '23:30'),
      end: at('2027-01-11', '23:59'),
    });
    expect(isOnDay(lateUtc, BERLIN, { ...filter, partOfDay: undefined })).toBe(true);
  });
});

describe('preferences as the rules read them', () => {
  const choices = { serviceIds: new Set(['svc-a']) };

  it('counts a repeated service once, and reads the window', () => {
    const parsed = unwrap(
      parsePreferences(
        {
          websiteId: 'tenant-1',
          serviceIds: ['svc-a', 'svc-a'],
          window: { startMinute: 480, endMinute: 780 },
        },
        choices,
      ),
    );
    expect(parsed).toEqual({
      serviceIds: ['svc-a'],
      window: { startMinute: 480, endMinute: 780 },
    });
  });

  it('refuses unknown services and a window that is not one, all at once', () => {
    const error = parsePreferences(
      {
        websiteId: 'tenant-1',
        serviceIds: ['nope'],
        window: { startMinute: 600, endMinute: 600 },
      },
      choices,
    )._unsafeUnwrapErr();
    expect(error.fieldErrors).toEqual({
      serviceIds: ['booking.validation.service_invalid'],
      window: ['booking.validation.time_range_invalid'],
    });
  });
});
