import { describe, expect, it } from 'vitest';

import { addDays, formatDate, formatRelativeTime, isSameDay } from '@lib/utils/date';

describe('formatDate', () => {
  it('formats in the requested time zone', () => {
    const instant = '2026-01-01T23:30:00Z';
    expect(formatDate(instant, 'en-US', 'UTC')).toBe('Jan 1, 2026');
    expect(formatDate(instant, 'en-US', 'Europe/Berlin')).toBe('Jan 2, 2026');
  });

  it('throws on an invalid date', () => {
    expect(() => formatDate('not-a-date', 'en-US', 'UTC')).toThrow(RangeError);
  });
});

describe('formatRelativeTime', () => {
  const now = '2026-06-15T12:00:00Z';

  it('formats past and future distances', () => {
    expect(formatRelativeTime('2026-06-13T12:00:00Z', now, 'en-US')).toBe('2 days ago');
    expect(formatRelativeTime('2026-06-15T15:00:00Z', now, 'en-US')).toBe('in 3 hours');
  });

  it('is deterministic because `now` is injected', () => {
    expect(formatRelativeTime(now, now, 'en-US')).toBe(formatRelativeTime(now, now, 'en-US'));
  });
});

describe('isSameDay', () => {
  it('compares calendar days in a given time zone', () => {
    expect(isSameDay('2026-01-01T23:30:00Z', '2026-01-01T01:00:00Z', 'UTC')).toBe(true);
    expect(isSameDay('2026-01-01T23:30:00Z', '2026-01-02T00:30:00Z', 'Europe/Berlin')).toBe(true);
    expect(isSameDay('2026-01-01T12:00:00Z', '2026-01-02T12:00:00Z', 'UTC')).toBe(false);
  });
});

describe('addDays', () => {
  it('adds and subtracts days without mutating the input', () => {
    const input = new Date('2026-01-31T00:00:00Z');
    expect(addDays(input, 1).toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(addDays(input, -1).toISOString()).toBe('2026-01-30T00:00:00.000Z');
    expect(input.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});
