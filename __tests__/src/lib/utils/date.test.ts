import { describe, expect, it } from 'vitest';

import {
  addDays,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  MS_PER_DAY,
  MS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from '@lib/utils/date';

describe('constants', () => {
  it('are the usual unit lengths', () => {
    expect(SECONDS_PER_MINUTE).toBe(60);
    expect(SECONDS_PER_HOUR).toBe(3600);
    expect(MS_PER_MINUTE).toBe(60_000);
    expect(MS_PER_DAY).toBe(86_400_000);
  });
});

describe('formatDate', () => {
  it('uses the given time zone, not the machine’s', () => {
    expect(formatDate('2026-01-05T23:30:00Z', 'de-DE', 'Europe/Berlin')).toBe('06.01.2026');
    expect(formatDate('2026-01-05T23:30:00Z', 'de-DE', 'UTC')).toBe('05.01.2026');
  });

  it('accepts a Date, an ISO string and epoch milliseconds', () => {
    const iso = '2026-03-01T12:00:00Z';

    expect(formatDate(new Date(iso), 'en-GB', 'UTC')).toBe(formatDate(iso, 'en-GB', 'UTC'));
    expect(formatDate(Date.parse(iso), 'en-GB', 'UTC')).toBe(formatDate(iso, 'en-GB', 'UTC'));
  });

  it('takes other Intl options', () => {
    expect(formatDate('2026-03-01T12:00:00Z', 'en-US', 'UTC', { month: 'long' })).toBe('March');
  });

  it.each(['not a date', Number.NaN, new Date('nope')])('rejects the invalid date %j', (input) => {
    expect(() => formatDate(input, 'en', 'UTC')).toThrow(RangeError);
  });

  it('rejects an unknown time zone', () => {
    expect(() => formatDate('2026-03-01', 'en', 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('formatDateTime', () => {
  it('shows date and time in the given zone', () => {
    expect(formatDateTime('2026-01-05T23:30:00Z', 'de-DE', 'Europe/Berlin')).toBe(
      '06.01.2026, 00:30',
    );
  });
});

describe('formatRelativeTime', () => {
  const now = '2026-06-15T12:00:00Z';

  it.each([
    ['2026-06-13T12:00:00Z', '2 days ago'],
    ['2026-06-15T09:00:00Z', '3 hours ago'],
    ['2026-06-15T11:55:00Z', '5 minutes ago'],
    ['2026-06-15T12:00:30Z', 'in 30 seconds'],
    ['2026-06-29T12:00:00Z', 'in 2 weeks'],
    ['2026-09-15T12:00:00Z', 'in 3 months'],
    ['2024-06-15T12:00:00Z', '2 years ago'],
    ['2026-06-16T12:00:00Z', 'tomorrow'],
  ])('puts %s as "%s"', (input, expected) => {
    expect(formatRelativeTime(input, now, 'en')).toBe(expected);
  });

  it('follows the locale', () => {
    expect(formatRelativeTime('2026-06-13T12:00:00Z', now, 'de')).toBe('vorgestern');
  });

  it('rejects an invalid date on either side', () => {
    expect(() => formatRelativeTime('x', now, 'en')).toThrow(RangeError);
    expect(() => formatRelativeTime(now, 'x', 'en')).toThrow(RangeError);
  });
});

describe('addDays', () => {
  it('moves forward and back, keeping the time of day', () => {
    expect(addDays('2026-01-31T10:00:00Z', 1).toISOString()).toBe('2026-02-01T10:00:00.000Z');
    expect(addDays('2026-03-01T10:00:00Z', -1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
  });

  it('is not shifted by a daylight-saving change', () => {
    expect(addDays('2026-03-28T23:30:00Z', 2).toISOString()).toBe('2026-03-30T23:30:00.000Z');
  });

  it('does not change its input', () => {
    const input = new Date('2026-01-01T00:00:00Z');

    addDays(input, 5);

    expect(input.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects an invalid date', () => {
    expect(() => addDays('x', 1)).toThrow(RangeError);
  });
});
