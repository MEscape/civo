import { describe, expect, it } from 'vitest';

import { instantToDate, parseInstant } from '@modules/booking/domain/time/instant';
import {
  firstInstantReading,
  resolveLocalTime,
  startOfLocalDay,
} from '@modules/booking/domain/time/local-time-resolution';
import { localDateOf, parseTimeZone, wallClockOf } from '@modules/booking/domain/time/time-zone';

import { BERLIN, NEW_YORK, at, clock, day, zone } from '../support/time-fixtures';

const MS_PER_HOUR = 3_600_000;

function iso(instant: Parameters<typeof instantToDate>[0]): string {
  return instantToDate(instant).toISOString();
}

describe('time zone names', () => {
  it('accepts real zones and returns the canonical spelling', () => {
    expect(parseTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
    expect(parseTimeZone('europe/berlin')).toBe('Europe/Berlin');
    expect(parseTimeZone('UTC')).toBe('UTC');
  });

  it('refuses unknown zones and malformed names', () => {
    expect(parseTimeZone('Mars/Olympus')).toBeNull();
    expect(parseTimeZone('')).toBeNull();
    expect(parseTimeZone('Europe/')).toBeNull();
    expect(parseTimeZone('../etc')).toBeNull();
    expect(parseTimeZone('Europe/Berlin; drop')).toBeNull();
  });
});

describe('wall clock and instant', () => {
  it('uses the offset of the date: winter +01:00, summer +02:00', () => {
    expect(iso(at('2027-01-11', '09:00'))).toBe('2027-01-11T08:00:00.000Z');
    expect(iso(at('2027-07-12', '09:00'))).toBe('2027-07-12T07:00:00.000Z');
  });

  it('is independent of the machine: the same wall clock is another instant elsewhere', () => {
    expect(iso(at('2027-01-11', '09:00', NEW_YORK))).toBe('2027-01-11T14:00:00.000Z');
    expect(iso(at('2027-07-12', '09:00', NEW_YORK))).toBe('2027-07-12T13:00:00.000Z');
  });

  it('handles a zone with a half-hour offset', () => {
    const kolkata = zone('Asia/Kolkata');
    expect(iso(at('2027-01-11', '09:00', kolkata))).toBe('2027-01-11T03:30:00.000Z');
    expect(clock(at('2027-01-11', '09:00', kolkata), kolkata)).toBe('2027-01-11 09:00');
  });

  it('reads the local date and minute of an instant, including across midnight', () => {
    const instant = parseInstant('2027-01-11T23:30:00Z');
    if (instant === null) {
      throw new Error('fixture');
    }
    expect(wallClockOf(instant, BERLIN)).toEqual({ date: day('2027-01-12'), minuteOfDay: 30 });
    expect(localDateOf(instant, NEW_YORK)).toEqual(day('2027-01-11'));
  });

  it('round-trips an unambiguous wall clock', () => {
    for (const date of ['2027-01-11', '2027-03-27', '2027-03-29', '2027-10-30', '2027-11-01']) {
      expect(clock(at(date, '09:45'))).toBe(`${date} 09:45`);
    }
  });
});

describe('spring forward (Europe/Berlin, 2027-03-28, 02:00 becomes 03:00)', () => {
  it('has no 02:30: the time is a gap, and its reading is the moment the clocks jump', () => {
    const resolution = resolveLocalTime(day('2027-03-28'), 150, BERLIN);
    expect(resolution.kind).toBe('gap');
    if (resolution.kind === 'gap') {
      expect(iso(resolution.transition)).toBe('2027-03-28T01:00:00.000Z');
      expect(clock(resolution.transition)).toBe('2027-03-28 03:00');
    }
  });

  it('has exact times on both sides of the gap', () => {
    expect(resolveLocalTime(day('2027-03-28'), 119, BERLIN).kind).toBe('exact');
    expect(resolveLocalTime(day('2027-03-28'), 180, BERLIN).kind).toBe('exact');
    expect(iso(at('2027-03-28', '01:59'))).toBe('2027-03-28T00:59:00.000Z');
    expect(iso(at('2027-03-28', '03:00'))).toBe('2027-03-28T01:00:00.000Z');
  });

  it('makes the day 23 hours long', () => {
    const length =
      startOfLocalDay(day('2027-03-29'), BERLIN) - startOfLocalDay(day('2027-03-28'), BERLIN);
    expect(length / MS_PER_HOUR).toBe(23);
  });

  it('keeps neighbouring days at 24 hours', () => {
    const before =
      startOfLocalDay(day('2027-03-28'), BERLIN) - startOfLocalDay(day('2027-03-27'), BERLIN);
    const after =
      startOfLocalDay(day('2027-03-30'), BERLIN) - startOfLocalDay(day('2027-03-29'), BERLIN);
    expect(before / MS_PER_HOUR).toBe(24);
    expect(after / MS_PER_HOUR).toBe(24);
  });
});

describe('fall back (Europe/Berlin, 2027-10-31, 03:00 becomes 02:00)', () => {
  it('has a 02:30 that happens twice: first in summer time, then in winter time', () => {
    const resolution = resolveLocalTime(day('2027-10-31'), 150, BERLIN);
    expect(resolution.kind).toBe('ambiguous');
    if (resolution.kind === 'ambiguous') {
      expect(iso(resolution.first)).toBe('2027-10-31T00:30:00.000Z');
      expect(iso(resolution.second)).toBe('2027-10-31T01:30:00.000Z');
      expect(clock(resolution.first)).toBe('2027-10-31 02:30');
      expect(clock(resolution.second)).toBe('2027-10-31 02:30');
    }
  });

  it('reads the first occurrence when asked for the first instant the clock reads that time', () => {
    expect(iso(firstInstantReading(day('2027-10-31'), 150, BERLIN))).toBe(
      '2027-10-31T00:30:00.000Z',
    );
  });

  it('is exact just before and just after the repeated hour', () => {
    expect(resolveLocalTime(day('2027-10-31'), 119, BERLIN).kind).toBe('exact');
    expect(resolveLocalTime(day('2027-10-31'), 180, BERLIN).kind).toBe('exact');
  });

  it('makes the day 25 hours long', () => {
    const length =
      startOfLocalDay(day('2027-11-01'), BERLIN) - startOfLocalDay(day('2027-10-31'), BERLIN);
    expect(length / MS_PER_HOUR).toBe(25);
  });
});

describe('other zones and transitions', () => {
  it('follows the United States rules, which change on other dates than Europe', () => {
    // 2027-03-14 02:00 -> 03:00 in New York, while Berlin is still on winter time.
    expect(resolveLocalTime(day('2027-03-14'), 150, NEW_YORK).kind).toBe('gap');
    expect(resolveLocalTime(day('2027-03-14'), 150, BERLIN).kind).toBe('exact');
    expect(resolveLocalTime(day('2027-11-07'), 90, NEW_YORK).kind).toBe('ambiguous');
  });

  it('handles a 30-minute daylight-saving shift (Lord Howe Island)', () => {
    const lordHowe = zone('Australia/Lord_Howe');
    // Starts 2027-10-03 02:00 -> 02:30: the half hour in between does not exist.
    expect(resolveLocalTime(day('2027-10-03'), 135, lordHowe).kind).toBe('gap');
    expect(resolveLocalTime(day('2027-10-03'), 150, lordHowe).kind).toBe('exact');
    // Ends 2027-04-04 02:00 -> 01:30: the half hour from 01:30 to 02:00 happens twice.
    expect(resolveLocalTime(day('2027-04-04'), 105, lordHowe).kind).toBe('ambiguous');
    expect(resolveLocalTime(day('2027-04-04'), 90, lordHowe).kind).toBe('ambiguous');
    expect(resolveLocalTime(day('2027-04-04'), 120, lordHowe).kind).toBe('exact');
  });

  it('starts a day at its first real instant when the zone skips local midnight', () => {
    // Brazil switched at midnight until 2018: 2018-11-04 00:00 became 01:00.
    const saoPaulo = zone('America/Sao_Paulo');
    expect(resolveLocalTime(day('2018-11-04'), 0, saoPaulo).kind).toBe('gap');
    expect(clock(startOfLocalDay(day('2018-11-04'), saoPaulo), saoPaulo)).toBe('2018-11-04 01:00');
  });

  it('terminates and still reads the jump for a time that is not a whole minute', () => {
    // Regression: the search halves a span of milliseconds; a span that was not a whole number of
    // seconds could make it stop moving.
    const whole = resolveLocalTime(day('2027-03-28'), 150, BERLIN);
    const fractional = resolveLocalTime(day('2027-03-28'), 150.0001, BERLIN);

    expect(whole.kind).toBe('gap');
    expect(fractional).toEqual(whole);
  });

  it('resolves midnight of the next day for minute 1440', () => {
    expect(iso(firstInstantReading(day('2027-01-11'), 1440, BERLIN))).toBe(
      iso(startOfLocalDay(day('2027-01-12'), BERLIN)),
    );
  });

  it('is valid at the edges of the supported years in every zone', () => {
    const tokyo = zone('Asia/Tokyo');
    const apia = zone('Pacific/Kiritimati');
    expect(clock(startOfLocalDay(day('1970-01-01'), tokyo), tokyo)).toBe('1970-01-01 00:00');
    expect(clock(startOfLocalDay(day('2200-12-31'), apia), apia)).toBe('2200-12-31 00:00');
    expect(clock(firstInstantReading(day('2200-12-31'), 1440, NEW_YORK), NEW_YORK)).toBe(
      '2201-01-01 00:00',
    );
  });
});
