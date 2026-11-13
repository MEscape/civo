import { describe, expect, it } from 'vitest';

import { daysOutsideLocation } from '@modules/booking/domain/models/employee-calendar';
import { CLOSED_DAY } from '@modules/booking/domain/scheduling/weekly-hours';
import type { DaySchedule, WeeklyHours } from '@modules/booking/domain/scheduling/weekly-hours';

const day = (...ranges: Array<[number, number]>): DaySchedule => ({
  ranges: ranges.map(([startMinute, endMinute]) => ({ startMinute, endMinute })),
  breaks: [],
});
const week = (weekdays: DaySchedule, weekend: DaySchedule = CLOSED_DAY): WeeklyHours => ({
  1: weekdays,
  2: weekdays,
  3: weekdays,
  4: weekdays,
  5: weekdays,
  6: weekend,
  7: weekend,
});

const H = 60;
const LOCATION = week(day([8 * H, 12 * H], [12 * H, 17 * H]));

describe('an employee works inside the location’s hours', () => {
  it('accepts a week inside the opening ranges, also across two ranges that touch', () => {
    expect(daysOutsideLocation(week(day([9 * H, 16 * H])), LOCATION)).toEqual([]);
    expect(daysOutsideLocation(week(day([8 * H, 17 * H])), LOCATION)).toEqual([]);
  });

  it('names each day on which a working range leaves the opening hours', () => {
    const own: WeeklyHours = {
      ...week(day([9 * H, 16 * H])),
      2: day([7 * H, 10 * H]),
      6: day([9 * H, 10 * H]),
    };

    expect(daysOutsideLocation(own, LOCATION)).toEqual([2, 6]);
  });

  it('does not join opening ranges with a gap between them', () => {
    const split = week(day([8 * H, 12 * H], [13 * H, 17 * H]));

    expect(daysOutsideLocation(week(day([11 * H, 14 * H])), split)).toEqual([1, 2, 3, 4, 5]);
  });

  it('accepts a day off whatever the location does', () => {
    expect(daysOutsideLocation(week(CLOSED_DAY), LOCATION)).toEqual([]);
  });
});
