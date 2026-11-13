import { describe, expect, it } from 'vitest';

import type { DayDto } from '@modules/booking/client';
import {
  changeHoursRange,
  intervalAt,
} from '@modules/booking/presentation/forms/week/change-range';
import { addInterval } from '@modules/booking/presentation/forms/week/draft';

const day = (intervals: Array<[string, string]>, breaks: Array<[string, string]> = []): DayDto => ({
  intervals: intervals.map(([start, end]) => ({ start, end })),
  breaks: breaks.map(([start, end]) => ({ start, end })),
});

/** The location is open 08:00–12:00 and 13:00–17:00 (minutes after midnight). */
const LIMITS = [
  { start: 480, end: 720 },
  { start: 780, end: 1020 },
];

describe('hours that must stay inside the opening hours of the place', () => {
  it('cannot be dragged past the end of the stretch they are in', () => {
    const next = changeHoursRange(
      day([['09:00', '11:00']]),
      { kind: 'intervals', index: 0, part: 'end', limits: LIMITS },
      180,
    );
    expect(next.intervals).toEqual([{ start: '09:00', end: '12:00' }]);
  });

  it('cannot be moved out of it either, and keeps its length', () => {
    const next = changeHoursRange(
      day([['09:00', '11:00']]),
      { kind: 'intervals', index: 0, part: 'move', limits: LIMITS },
      -240,
    );
    expect(next.intervals).toEqual([{ start: '08:00', end: '10:00' }]);
  });

  it('cannot start before the place opens, with the other edge left where it was', () => {
    const next = changeHoursRange(
      day([['09:00', '11:00']]),
      { kind: 'intervals', index: 0, part: 'start', limits: LIMITS },
      -300,
    );
    expect(next.intervals).toEqual([{ start: '08:00', end: '11:00' }]);
  });

  it('may use the whole day where nothing limits it', () => {
    const next = changeHoursRange(
      day([['09:00', '11:00']]),
      { kind: 'intervals', index: 0, part: 'start' },
      -300,
    );
    expect(next.intervals).toEqual([{ start: '04:00', end: '11:00' }]);
  });

  it('lets a break move inside the hours as before', () => {
    const next = changeHoursRange(
      day([['08:00', '12:00']], [['10:00', '10:30']]),
      { kind: 'breaks', index: 0, part: 'move', limits: LIMITS },
      30,
    );
    expect(next.breaks).toEqual([{ start: '10:30', end: '11:00' }]);
  });
});

describe('opening a range by pressing on the bar', () => {
  it('opens one where the place is open, no longer than the stretch allows', () => {
    const created = intervalAt(day([]), 690, LIMITS);
    expect(created?.day.intervals).toEqual([{ start: '11:30', end: '12:00' }]);
  });

  it('opens nothing where the place is closed', () => {
    expect(intervalAt(day([]), 740, LIMITS)).toBeNull();
    expect(intervalAt(day([]), 400, LIMITS)).toBeNull();
  });

  it('opens nothing on a day the place is closed all day', () => {
    expect(intervalAt(day([]), 600, [])).toBeNull();
  });

  it('opens anywhere without limits', () => {
    expect(intervalAt(day([]), 740)?.day.intervals).toEqual([{ start: '12:20', end: '13:20' }]);
  });
});

describe('"open" on a closed day', () => {
  it('starts from the first stretch the place is open', () => {
    expect(addInterval(day([]), LIMITS).intervals).toEqual([{ start: '08:00', end: '12:00' }]);
  });

  it('starts from a working day without limits', () => {
    expect(addInterval(day([])).intervals).toEqual([{ start: '08:00', end: '17:00' }]);
  });
});
