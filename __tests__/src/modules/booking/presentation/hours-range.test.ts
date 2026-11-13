import { describe, expect, it } from 'vitest';

import type { DayDto } from '@modules/booking/presentation/dto/location-dto';
import { intervalAt } from '@modules/booking/presentation/forms/week/change-range';
import {
  DEFAULT_HOURS_RANGE,
  marksOf,
  widenRange,
} from '@modules/booking/presentation/forms/week/range';

const day = (...intervals: Array<[string, string]>): DayDto => ({
  intervals: intervals.map(([start, end]) => ({ start, end })),
  breaks: [],
});

describe('hours range of a bar', () => {
  it('starts on the hours that matter, with a mark every two hours', () => {
    expect(DEFAULT_HOURS_RANGE).toEqual({ from: 360, to: 1200, step: 120 });
    expect(marksOf(DEFAULT_HOURS_RANGE)).toEqual([360, 480, 600, 720, 840, 960, 1080, 1200]);
  });

  it('keeps the range while the hours stay inside it, and returns the same object', () => {
    expect(widenRange(DEFAULT_HOURS_RANGE, [day(['08:00', '18:00'])])).toBe(DEFAULT_HOURS_RANGE);
  });

  it('widens to hold what lies outside, by whole hours, and never narrows again', () => {
    const wider = widenRange(DEFAULT_HOURS_RANGE, [day(['05:30', '21:15'])]);
    expect(wider.from).toBeLessThanOrEqual(330);
    expect(wider.to).toBeGreaterThanOrEqual(1275);
    expect(widenRange(wider, [day(['08:00', '09:00'])])).toBe(wider);
  });

  it('marks every three hours once two-hour marks would crowd the axis', () => {
    const wide = widenRange(DEFAULT_HOURS_RANGE, [day(['00:00', '24:00'])]);
    expect(wide).toEqual({ from: 0, to: 1440, step: 180 });
    expect(marksOf(wide)).toHaveLength(9);
  });
});

describe('intervalAt (a press on the empty bar)', () => {
  it('opens an hour at the pressed time and puts it in order among the others', () => {
    const created = intervalAt(day(['08:00', '09:00'], ['16:00', '18:00']), 12 * 60);
    expect(created?.index).toBe(1);
    expect(created?.day.intervals).toEqual([
      { start: '08:00', end: '09:00' },
      { start: '12:00', end: '13:00' },
      { start: '16:00', end: '18:00' },
    ]);
  });

  it('stops at the next opening time instead of overlapping it', () => {
    const created = intervalAt(day(['12:30', '14:00']), 12 * 60);
    expect(created?.day.intervals[0]).toEqual({ start: '12:00', end: '12:30' });
  });

  it('does nothing where the press fell inside a range or leaves no room', () => {
    expect(intervalAt(day(['08:00', '12:00']), 9 * 60)).toBeNull();
    expect(intervalAt(day(['08:00', '12:00']), 24 * 60)).toBeNull();
  });
});
