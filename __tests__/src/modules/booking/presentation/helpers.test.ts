import { describe, expect, it } from 'vitest';

import { buildCalendarFile } from '@modules/booking/presentation/components/flow/calendar-file';
import {
  collectDetails,
  validateDetails,
} from '@modules/booking/presentation/components/flow/details-validation';
import {
  compareYearMonth,
  daysInMonth,
  firstDayOf,
  lastDayOf,
  monthCells,
  shiftMonth,
  yearMonthOf,
} from '@modules/booking/presentation/components/flow/month-math';
import { toWallClock } from '@modules/booking/presentation/time/zoned-time';

import { service } from './fixtures';

describe('month math', () => {
  it('reads a year and month from a local date', () => {
    expect(yearMonthOf('2026-10-12')).toEqual({ year: 2026, month: 10 });
    expect(yearMonthOf('12.10.2026')).toBeNull();
  });

  it('pages across a year boundary in both directions', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 });
    expect(shiftMonth({ year: 2026, month: 1 }, -13)).toEqual({ year: 2024, month: 12 });
  });

  it('orders months', () => {
    expect(compareYearMonth({ year: 2026, month: 2 }, { year: 2026, month: 10 })).toBeLessThan(0);
    expect(compareYearMonth({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBeGreaterThan(
      0,
    );
    expect(compareYearMonth({ year: 2026, month: 3 }, { year: 2026, month: 3 })).toBe(0);
  });

  it('knows the length of every kind of month', () => {
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30);
    expect(daysInMonth({ year: 2026, month: 12 })).toBe(31);
  });

  it('names the first and last day', () => {
    expect(firstDayOf({ year: 2026, month: 2 })).toBe('2026-02-01');
    expect(lastDayOf({ year: 2028, month: 2 })).toBe('2028-02-29');
  });

  it('lays a month out Monday-first, padding the week before the first day', () => {
    // 1 Oct 2026 is a Thursday: three empty cells, then 31 days.
    const cells = monthCells({ year: 2026, month: 10 });
    expect(cells.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(cells).toHaveLength(3 + 31);
    expect(cells.at(-1)).toBe('2026-10-31');
    // 1 Jun 2026 is a Monday: no padding.
    expect(monthCells({ year: 2026, month: 6 })[0]).toBe('2026-06-01');
  });
});

describe('details validation', () => {
  const passport = service();

  it('requires the fields the service marks as required', () => {
    expect(validateDetails(passport, {})).toEqual({
      firstName: 'booking.validation.field_required',
      lastName: 'booking.validation.field_required',
      email: 'booking.validation.email_required',
    });
  });

  it('treats whitespace as empty', () => {
    expect(validateDetails(passport, { firstName: '   ', lastName: 'L', email: 'a@b.de' })).toEqual(
      {
        firstName: 'booking.validation.field_required',
      },
    );
  });

  it('accepts a complete, valid set and leaves optional fields optional', () => {
    expect(
      validateDetails(passport, {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.org',
      }),
    ).toEqual({});
  });

  it('rejects a malformed e-mail address and a phone number with letters', () => {
    const errors = validateDetails(passport, {
      firstName: 'Ada',
      lastName: 'L',
      email: 'not-an-email',
      phone: 'call me',
    });
    expect(errors['email']).toBe('booking.validation.email_invalid');
    expect(errors['phone']).toBe('booking.validation.field_required');
  });

  it('rejects text longer than the limit', () => {
    const errors = validateDetails(passport, {
      firstName: 'x'.repeat(500),
      lastName: 'L',
      email: 'a@b.de',
    });
    expect(errors['firstName']).toBe('booking.validation.text_too_long');
  });

  it('does not validate fields the service does not ask for', () => {
    expect(
      validateDetails(passport, {
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.de',
        notes: 'x'.repeat(5000),
      }),
    ).toEqual({});
  });

  it('collects only requested, non-empty, trimmed values', () => {
    expect(
      collectDetails(passport, {
        firstName: ' Ada ',
        lastName: 'Lovelace',
        email: 'ada@example.org',
        phone: '',
        notes: 'ignored',
      }),
    ).toEqual({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.org' });
  });
});

describe('wall clock at the location', () => {
  it('uses the location zone, not the browser zone', () => {
    expect(toWallClock('2026-10-12T08:00:00.000Z', 'Europe/Berlin')).toEqual({
      date: '2026-10-12',
      time: '10:00',
    });
    expect(toWallClock('2026-10-12T08:00:00.000Z', 'America/New_York')).toEqual({
      date: '2026-10-12',
      time: '04:00',
    });
  });

  it('can land on the next calendar day', () => {
    expect(toWallClock('2026-10-12T23:30:00.000Z', 'Europe/Berlin')).toEqual({
      date: '2026-10-13',
      time: '01:30',
    });
  });

  it('follows daylight saving time', () => {
    expect(toWallClock('2026-03-28T23:30:00.000Z', 'Europe/Berlin').time).toBe('00:30');
    expect(toWallClock('2026-03-29T00:30:00.000Z', 'Europe/Berlin').time).toBe('01:30');
    expect(toWallClock('2026-03-29T01:30:00.000Z', 'Europe/Berlin').time).toBe('03:30');
  });

  it('accepts a Date', () => {
    expect(toWallClock(new Date('2026-01-01T12:00:00Z'), 'Europe/Berlin').time).toBe('13:00');
  });

  it('falls back to UTC for an unknown zone instead of failing', () => {
    expect(toWallClock('2026-10-12T08:00:00.000Z', 'Mars/Olympus')).toEqual({
      date: '2026-10-12',
      time: '08:00',
    });
  });
});

describe('calendar file', () => {
  const input = {
    uid: 'BK-ABCD-2345',
    title: 'Passport, appointment; bring ID',
    start: '2026-10-12T08:00:00.000Z',
    end: '2026-10-12T08:20:00.000Z',
    location: 'Town hall, Marktplatz 1',
    description: 'Line one\nLine two',
  };
  const stamp = new Date('2026-10-01T09:30:15.123Z');

  it('writes a complete event in UTC', () => {
    const file = buildCalendarFile(input, stamp);
    expect(file.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(file.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(file).toContain('UID:BK-ABCD-2345@civo.booking\r\n');
    expect(file).toContain('DTSTAMP:20261001T093015Z\r\n');
    expect(file).toContain('DTSTART:20261012T080000Z\r\n');
    expect(file).toContain('DTEND:20261012T082000Z\r\n');
  });

  it('escapes the characters the format reserves', () => {
    const file = buildCalendarFile(input, stamp);
    expect(file).toContain('SUMMARY:Passport\\, appointment\\; bring ID\r\n');
    expect(file).toContain('DESCRIPTION:Line one\\nLine two\r\n');
  });

  it('omits location and description when there are none', () => {
    const file = buildCalendarFile({ ...input, location: null, description: null }, stamp);
    expect(file).not.toContain('LOCATION');
    expect(file).not.toContain('DESCRIPTION');
  });

  it('folds long lines at 73 characters with a leading space on the continuation', () => {
    const file = buildCalendarFile({ ...input, description: 'x'.repeat(200) }, stamp);
    for (const line of file.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(74);
    }
    expect(file).toContain('\r\n x');
  });
});
