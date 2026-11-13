import { describe, expect, it } from 'vitest';

import type { ExceptionInputDto } from '@modules/booking/client';
import {
  BLANK_EXCEPTION,
  countsOf,
  holidayOf,
  rowsOf,
  tabOf,
  withFrom,
  withKind,
  withHolidays,
} from '@modules/booking/presentation/forms/exceptions';

const closed = (from: string, to = from): ExceptionInputDto => ({ kind: 'closed', from, to });
const special: ExceptionInputDto = {
  kind: 'override',
  from: '2027-12-24',
  to: '2027-12-24',
  day: { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] },
};

describe('which part of the list an exception is in', () => {
  it('calls a closure on a holiday a holiday, and any other closure a closure', () => {
    expect(tabOf(closed('2027-03-26'))).toBe('holidays');
    expect(tabOf(closed('2027-06-12'))).toBe('closures');
    expect(tabOf(closed('2027-03-26', '2027-03-28'))).toBe('closures');
    expect(tabOf(BLANK_EXCEPTION)).toBe('closures');
  });

  it('calls other hours and extra hours special, even on a holiday', () => {
    expect(tabOf(special)).toBe('special');
    expect(tabOf({ ...special, kind: 'additional', from: '2027-01-01', to: '2027-01-01' })).toBe(
      'special',
    );
  });

  it('counts each part from the data', () => {
    expect(countsOf([closed('2027-01-01'), closed('2027-06-12'), special])).toEqual({
      all: 3,
      holidays: 1,
      special: 1,
      closures: 1,
    });
  });
});

describe('the rows of a tab', () => {
  const list = [closed('2027-12-26'), special, closed('2027-01-01'), BLANK_EXCEPTION];

  it('come earliest first with a blank row last, each with its place in the form', () => {
    expect(rowsOf(list, 'all').map(({ index }) => index)).toEqual([2, 1, 0, 3]);
  });

  it('keep only the tab asked for', () => {
    expect(rowsOf(list, 'holidays').map(({ index }) => index)).toEqual([2, 0]);
    expect(rowsOf(list, 'special').map(({ index }) => index)).toEqual([1]);
    expect(rowsOf(list, 'closures').map(({ index }) => index)).toEqual([3]);
  });
});

describe('importing the holidays of a state', () => {
  it('adds fixed holidays and Easter-relative ones on the days of that year', () => {
    const { next, added } = withHolidays([], 'DE', 2027);

    const dates = next.map(({ from }) => from);
    // Easter Sunday 2027 is 28 March: Good Friday is the 26th, Easter Monday the 29th.
    expect(dates).toContain('2027-03-26');
    expect(dates).toContain('2027-03-29');
    expect(dates).toContain('2027-01-01');
    expect(dates).toContain('2027-10-03');
    expect(added).toBe(next.length);
    expect(next.every(({ kind, from, to }) => kind === 'closed' && from === to)).toBe(true);
  });

  it('moves with Easter from one year to the next', () => {
    const in2026 = withHolidays([], 'DE', 2026).next.map(({ from }) => from);

    expect(in2026).toContain('2026-04-03');
    expect(in2026).toContain('2026-04-06');
    expect(in2026).not.toContain('2026-03-26');
  });

  it('adds what a state keeps on top of the nationwide ones', () => {
    const germany = withHolidays([], 'DE', 2027).added;
    const bavaria = withHolidays([], 'BY', 2027).next.map(({ from }) => from);

    expect(withHolidays([], 'BY', 2027).added).toBeGreaterThan(germany);
    expect(bavaria).toContain('2027-01-06');
    expect(withHolidays([], 'DE', 2027).next.map(({ from }) => from)).not.toContain('2027-01-06');
  });

  it('never overwrites a day somebody entered, and adds nothing the second time', () => {
    const entered = [closed('2027-12-24', '2027-12-27'), special];

    const first = withHolidays(entered, 'DE', 2027);
    const second = withHolidays(first.next, 'DE', 2027);

    // Christmas Day and Boxing Day lie inside the entered closure.
    expect(first.next.filter(({ from }) => from === '2027-12-25' || from === '2027-12-26')).toEqual(
      [],
    );
    expect(first.next.slice(0, 2)).toEqual(entered);
    expect(second.added).toBe(0);
    expect(second.next).toEqual(first.next);
  });
});

describe('changing an exception', () => {
  it('brings a day to fill in when a closure becomes other hours, and drops it for a closure', () => {
    const asOverride = withKind(closed('2027-06-12'), 'override');
    expect(asOverride).toEqual({
      kind: 'override',
      from: '2027-06-12',
      to: '2027-06-12',
      day: { intervals: [], breaks: [] },
    });
    expect(withKind(special, 'additional').day).toEqual(special.day);
    expect(withKind(special, 'closed')).toEqual({
      kind: 'closed',
      from: '2027-12-24',
      to: '2027-12-24',
    });
  });

  it('keeps a day entered alone one day, and a run a run', () => {
    expect(withFrom(closed('2027-06-12'), '2027-06-14')).toEqual(closed('2027-06-14'));
    expect(withFrom(closed(''), '2027-06-14')).toEqual(closed('2027-06-14'));
    expect(withFrom(closed('2027-06-12', '2027-06-20'), '2027-06-14')).toEqual(
      closed('2027-06-14', '2027-06-20'),
    );
  });

  it('names the holiday of a one-day closure, and nothing else', () => {
    expect(holidayOf(closed('2027-03-26'))).toBeDefined();
    expect(holidayOf(closed('2027-06-12'))).toBeUndefined();
    expect(holidayOf(closed('2027-03-26', '2027-03-27'))).toBeUndefined();
    expect(holidayOf(BLANK_EXCEPTION)).toBeUndefined();
    expect(holidayOf({ ...special, from: '2027-03-26', to: '2027-03-26' })).toBeUndefined();
  });
});
