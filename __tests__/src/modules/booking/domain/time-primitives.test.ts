import { describe, expect, it } from 'vitest';

import {
  addMinutes,
  instantFromDate,
  instantToDate,
  parseInstant,
  subtractMinutes,
  toInstant,
} from '@modules/booking/domain/time/instant';
import {
  addLocalDays,
  createLocalDate,
  daysBetween,
  formatLocalDate,
  parseLocalDate,
  weekdayOf,
} from '@modules/booking/domain/time/local-date';
import { createLocalDateRange, datesOf } from '@modules/booking/domain/time/local-date-range';
import { MAX_MINUTES, minutesToMs, parseMinutes } from '@modules/booking/domain/time/minutes';
import { formatTimeOfDay, parseTimeOfDay } from '@modules/booking/domain/time/time-of-day';

import { day } from '../support/time-fixtures';

function minutes(value: number) {
  const parsed = parseMinutes(value);
  if (parsed === null) {
    throw new Error(`not minutes: ${value}`);
  }
  return parsed;
}

describe('minutes', () => {
  it('accepts whole minutes from zero to a year', () => {
    expect(parseMinutes(0)).toBe(0);
    expect(parseMinutes(45)).toBe(45);
    expect(parseMinutes(MAX_MINUTES)).toBe(MAX_MINUTES);
  });

  it('refuses negative, fractional, non-finite and oversized lengths', () => {
    for (const value of [-1, 0.5, 7.25, Number.NaN, Number.POSITIVE_INFINITY, MAX_MINUTES + 1]) {
      expect(parseMinutes(value)).toBeNull();
    }
  });

  it('converts to milliseconds in one place', () => {
    expect(minutesToMs(minutes(1))).toBe(60_000);
    expect(minutesToMs(minutes(90))).toBe(5_400_000);
  });
});

describe('instants', () => {
  it('parses ISO text that carries its offset and normalizes it to the same moment', () => {
    const utc = parseInstant('2027-01-11T08:00:00Z');
    expect(utc).not.toBeNull();
    expect(parseInstant('2027-01-11T09:00:00+01:00')).toBe(utc);
    expect(parseInstant('2027-01-11T03:00:00-05:00')).toBe(utc);
    expect(parseInstant('2027-01-11T08:00:00.000Z')).toBe(utc);
  });

  it('refuses text without an offset, because it would mean the machine zone', () => {
    expect(parseInstant('2027-01-11T09:00:00')).toBeNull();
    expect(parseInstant('2027-01-11T09:00')).toBeNull();
    expect(parseInstant('2027-01-11')).toBeNull();
    expect(parseInstant('11.01.2027 09:00')).toBeNull();
    expect(parseInstant('not a date')).toBeNull();
  });

  it('refuses text that names a moment that does not exist', () => {
    // Regression: `Date.parse` alone rolls 02-30 over to 03-02 instead of refusing it.
    expect(parseInstant('2027-02-30T09:00:00Z')).toBeNull();
    expect(parseInstant('2027-13-01T09:00:00Z')).toBeNull();
    expect(parseInstant('2027-01-11T24:00:00Z')).toBeNull();
    expect(parseInstant('2027-01-11T09:60:00Z')).toBeNull();
    expect(parseInstant('2027-01-11T09:00:60Z')).toBeNull();
    expect(parseInstant('2027-01-11T09:00:00+24:00')).toBeNull();
    expect(parseInstant('2027-01-11T09:00:00+01:60')).toBeNull();
  });

  it('refuses fractional milliseconds, invalid dates and instants outside the supported years', () => {
    expect(toInstant(1.5)).toBeNull();
    expect(toInstant(Number.NaN)).toBeNull();
    expect(toInstant(Date.UTC(1960, 0, 1))).toBeNull();
    expect(toInstant(Date.UTC(2300, 0, 1))).toBeNull();
    expect(instantFromDate(new Date('garbage'))).toBeNull();
  });

  it('round-trips through Date without changing the moment', () => {
    const instant = parseInstant('2027-06-01T10:15:30.250Z');
    expect(instant).not.toBeNull();
    if (instant === null) {
      return;
    }
    expect(instantFromDate(instantToDate(instant))).toBe(instant);
    expect(instantToDate(instant).toISOString()).toBe('2027-06-01T10:15:30.250Z');
  });

  it('adds and subtracts minutes as elapsed time', () => {
    const start = parseInstant('2027-01-11T08:00:00Z');
    if (start === null) {
      throw new Error('fixture');
    }
    expect(instantToDate(addMinutes(start, minutes(90))).toISOString()).toBe(
      '2027-01-11T09:30:00.000Z',
    );
    expect(instantToDate(subtractMinutes(start, minutes(10))).toISOString()).toBe(
      '2027-01-11T07:50:00.000Z',
    );
  });
});

describe('local dates', () => {
  it('rejects dates that do not exist', () => {
    expect(parseLocalDate('2027-02-29')).toBeNull();
    expect(parseLocalDate('2028-02-29')).not.toBeNull();
    expect(parseLocalDate('2100-02-29')).toBeNull();
    expect(parseLocalDate('2000-02-29')).not.toBeNull();
    expect(parseLocalDate('2027-13-01')).toBeNull();
    expect(parseLocalDate('2027-00-10')).toBeNull();
    expect(parseLocalDate('2027-04-31')).toBeNull();
    expect(parseLocalDate('27-01-01')).toBeNull();
    expect(parseLocalDate('2027-1-1')).toBeNull();
  });

  it('refuses years outside the supported range', () => {
    expect(createLocalDate(1969, 12, 31)).toBeNull();
    expect(createLocalDate(1970, 1, 1)).not.toBeNull();
    expect(createLocalDate(2200, 12, 31)).not.toBeNull();
    expect(createLocalDate(2201, 1, 1)).toBeNull();
    expect(createLocalDate(2027.5, 1, 1)).toBeNull();
  });

  it('formats and parses the same text', () => {
    expect(formatLocalDate(day('2027-03-09'))).toBe('2027-03-09');
  });

  it('does calendar arithmetic across month, year and leap-day ends', () => {
    expect(formatLocalDate(addLocalDays(day('2027-12-31'), 1))).toBe('2028-01-01');
    expect(formatLocalDate(addLocalDays(day('2028-03-01'), -1))).toBe('2028-02-29');
    expect(formatLocalDate(addLocalDays(day('2027-03-01'), -1))).toBe('2027-02-28');
    expect(daysBetween(day('2027-03-27'), day('2027-03-29'))).toBe(2);
    expect(daysBetween(day('2027-03-29'), day('2027-03-27'))).toBe(-2);
  });

  it('numbers weekdays from Monday = 1 to Sunday = 7', () => {
    expect(weekdayOf(day('2027-01-11'))).toBe(1);
    expect(weekdayOf(day('2027-01-13'))).toBe(3);
    expect(weekdayOf(day('2027-01-16'))).toBe(6);
    expect(weekdayOf(day('2027-01-17'))).toBe(7);
  });
});

describe('local date ranges', () => {
  it('includes both ends', () => {
    const range = createLocalDateRange(day('2027-01-11'), day('2027-01-13'), 62);
    expect(range?.from).toEqual(day('2027-01-11'));
    expect(range === null ? [] : datesOf(range).map(formatLocalDate)).toEqual([
      '2027-01-11',
      '2027-01-12',
      '2027-01-13',
    ]);
  });

  it('is valid for a single day and refuses a reversed or too long range', () => {
    expect(createLocalDateRange(day('2027-01-11'), day('2027-01-11'), 62)).not.toBeNull();
    expect(createLocalDateRange(day('2027-01-12'), day('2027-01-11'), 62)).toBeNull();
    // 1 January to 3 March is exactly 62 days, both ends included.
    expect(createLocalDateRange(day('2027-01-01'), day('2027-03-04'), 62)).toBeNull();
    expect(createLocalDateRange(day('2027-01-01'), day('2027-03-03'), 62)).not.toBeNull();
  });
});

describe('times of day', () => {
  it('parses HH:mm, including 24:00 as an end of day', () => {
    expect(parseTimeOfDay('00:00')).toBe(0);
    expect(parseTimeOfDay('09:30')).toBe(570);
    expect(parseTimeOfDay('23:59')).toBe(1439);
    expect(parseTimeOfDay('24:00')).toBe(1440);
  });

  it('refuses everything else', () => {
    for (const text of ['24:01', '25:00', '09:60', '9:30', '0930', '09:30:00', '', '-1:00']) {
      expect(parseTimeOfDay(text)).toBeNull();
    }
  });

  it('formats minutes back to the same text', () => {
    expect(formatTimeOfDay(570)).toBe('09:30');
    expect(formatTimeOfDay(0)).toBe('00:00');
    expect(formatTimeOfDay(1440)).toBe('24:00');
  });
});
