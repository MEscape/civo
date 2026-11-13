import { describe, expect, it } from 'vitest';

import {
  CLOSED_DAY,
  createTimeRange,
  windowsForDate,
  windowsForRange,
} from '@modules/booking/domain/scheduling/weekly-hours';
import type { DaySchedule, WeeklyHours } from '@modules/booking/domain/scheduling/weekly-hours';
import { createLocalDateRange } from '@modules/booking/domain/time/local-date-range';
import { intervalLengthMinutes } from '@modules/booking/domain/time/time-interval';
import type { TimeInterval } from '@modules/booking/domain/time/time-interval';

import { BERLIN, NEW_YORK, clock, day } from '../support/time-fixtures';

function range(from: number, to: number) {
  const created = createTimeRange(from, to);
  if (created === null) {
    throw new Error('fixture');
  }
  return created;
}

function schedule(
  ranges: Array<[number, number]>,
  breaks: Array<[number, number]> = [],
): DaySchedule {
  return {
    ranges: ranges.map(([from, to]) => range(from, to)),
    breaks: breaks.map(([from, to]) => range(from, to)),
  };
}

function weekOf(monday: DaySchedule, others: DaySchedule = CLOSED_DAY): WeeklyHours {
  return { 1: monday, 2: others, 3: others, 4: others, 5: others, 6: others, 7: others };
}

/** The combined length of the windows, in elapsed minutes. */
function totalMinutes(windows: readonly TimeInterval[]): number {
  return windows.reduce((sum, window) => sum + intervalLengthMinutes(window), 0);
}

function wall(windows: readonly TimeInterval[]): string[] {
  return windows.map((window) => `${clock(window.start)} - ${clock(window.end)}`);
}

describe('time ranges', () => {
  it('accepts whole-minute ranges inside a day, ending as late as midnight', () => {
    expect(createTimeRange(0, 1440)).toEqual({ startMinute: 0, endMinute: 1440 });
    expect(createTimeRange(480, 1020)).not.toBeNull();
  });

  it('refuses empty, reversed, fractional and out-of-day ranges', () => {
    expect(createTimeRange(480, 480)).toBeNull();
    expect(createTimeRange(600, 480)).toBeNull();
    expect(createTimeRange(480.5, 600)).toBeNull();
    expect(createTimeRange(-1, 600)).toBeNull();
    expect(createTimeRange(480, 1441)).toBeNull();
    expect(createTimeRange(1440, 1441)).toBeNull();
  });
});

describe('the windows of one day', () => {
  it('turns ranges into instants on the wall clock of the zone', () => {
    const windows = windowsForDate(schedule([[480, 1020]]), day('2027-01-11'), BERLIN);
    expect(wall(windows)).toEqual(['2027-01-11 08:00 - 2027-01-11 17:00']);
    expect(windowsForDate(schedule([[480, 1020]]), day('2027-01-11'), NEW_YORK)[0]?.start).not.toBe(
      windows[0]?.start,
    );
  });

  it('subtracts breaks, never implies them', () => {
    const windows = windowsForDate(
      schedule([[480, 1020]], [[720, 780]]),
      day('2027-01-11'),
      BERLIN,
    );
    expect(wall(windows)).toEqual([
      '2027-01-11 08:00 - 2027-01-11 12:00',
      '2027-01-11 13:00 - 2027-01-11 17:00',
    ]);
  });

  it('merges overlapping ranges and ignores a break outside them', () => {
    const windows = windowsForDate(
      schedule(
        [
          [480, 720],
          [600, 900],
        ],
        [[1000, 1060]],
      ),
      day('2027-01-11'),
      BERLIN,
    );
    expect(wall(windows)).toEqual(['2027-01-11 08:00 - 2027-01-11 15:00']);
  });

  it('gives nothing for a closed day or a range swallowed whole by a break', () => {
    expect(windowsForDate(CLOSED_DAY, day('2027-01-11'), BERLIN)).toEqual([]);
    expect(windowsForDate(schedule([[600, 660]], [[540, 720]]), day('2027-01-11'), BERLIN)).toEqual(
      [],
    );
  });

  it('is as long as the clock says on the 23-hour spring day', () => {
    const windows = windowsForDate(schedule([[0, 240]]), day('2027-03-28'), BERLIN);
    expect(windows).toHaveLength(1);
    // 00:00 to 04:00 on the wall clock, but 02:00 to 03:00 does not exist.
    expect(totalMinutes(windows)).toBe(180);
  });

  it('is as long as the clock says on the 25-hour autumn day', () => {
    const windows = windowsForDate(schedule([[0, 240]]), day('2027-10-31'), BERLIN);
    expect(totalMinutes(windows)).toBe(300);
  });

  it('starts a range inside the spring gap when the clocks jump, not later', () => {
    const windows = windowsForDate(schedule([[150, 300]]), day('2027-03-28'), BERLIN);
    // 02:30 is never read; the first time the clock reads 02:30 or later is 03:00.
    expect(wall(windows)).toEqual(['2027-03-28 03:00 - 2027-03-28 05:00']);
  });

  it('ends a range inside the spring gap when the clocks jump, not half an hour after', () => {
    const windows = windowsForDate(schedule([[60, 150]]), day('2027-03-28'), BERLIN);
    // Open until the clock would read 02:30; it jumps from 02:00 to 03:00, so that is 03:00.
    expect(wall(windows)).toEqual(['2027-03-28 01:00 - 2027-03-28 03:00']);
    expect(totalMinutes(windows)).toBe(60);
  });

  it('drops a range that lies entirely inside the spring gap', () => {
    // Regression: shifting both ends forward would have kept it alive as 03:10-03:30.
    expect(windowsForDate(schedule([[130, 150]]), day('2027-03-28'), BERLIN)).toEqual([]);
  });

  it('reads a range that starts in the repeated hour from its first occurrence', () => {
    const windows = windowsForDate(schedule([[150, 240]]), day('2027-10-31'), BERLIN);
    // From the first 02:30 (summer time) to 04:00 (winter time): 2h30 elapsed, not 1h30.
    expect(totalMinutes(windows)).toBe(150);
  });
});

describe('the windows of a range of days', () => {
  function days(from: string, to: string) {
    const created = createLocalDateRange(day(from), day(to), 62);
    if (created === null) {
      throw new Error('fixture');
    }
    return created;
  }

  it('applies each weekday its own schedule, earliest first', () => {
    const week = weekOf(schedule([[540, 600]]), schedule([[900, 960]]));
    const windows = windowsForRange(week, days('2027-01-11', '2027-01-13'), BERLIN);
    expect(wall(windows)).toEqual([
      '2027-01-11 09:00 - 2027-01-11 10:00',
      '2027-01-12 15:00 - 2027-01-12 16:00',
      '2027-01-13 15:00 - 2027-01-13 16:00',
    ]);
  });

  it('merges windows that meet at midnight into one', () => {
    const week = weekOf(schedule([[1320, 1440]]), schedule([[0, 120]]));
    const windows = windowsForRange(week, days('2027-01-11', '2027-01-12'), BERLIN);
    expect(wall(windows)).toEqual(['2027-01-11 22:00 - 2027-01-12 02:00']);
  });

  it('keeps windows separate when a minute of closure lies between them', () => {
    const week = weekOf(schedule([[1320, 1439]]), schedule([[0, 120]]));
    expect(windowsForRange(week, days('2027-01-11', '2027-01-12'), BERLIN)).toHaveLength(2);
  });

  it('is empty for a week that is closed', () => {
    expect(windowsForRange(weekOf(CLOSED_DAY), days('2027-01-11', '2027-01-17'), BERLIN)).toEqual(
      [],
    );
  });
});
