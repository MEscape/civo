import { describe, expect, it } from 'vitest';

import { workdayOf } from '@modules/booking/application/services/day-plan';
import { asInstant } from '@modules/booking/domain/time/instant';
import type { TimeZone } from '@modules/booking/domain/time/time-zone';

const BERLIN = 'Europe/Berlin' as TimeZone;
const window = (start: string, end: string) => ({
  start: asInstant(Date.parse(`2027-01-15T${start}:00+01:00`)),
  end: asInstant(Date.parse(`2027-01-15T${end}:00+01:00`)),
});

describe('the working day of the day plan', () => {
  it('is nothing on a day off', () => {
    expect(workdayOf([], BERLIN)).toBeNull();
  });

  it('runs from the first start to the last end, on the clock of the location', () => {
    expect(workdayOf([window('08:00', '16:00')], BERLIN)).toEqual({
      start: '2027-01-15T08:00:00+01:00',
      end: '2027-01-15T16:00:00+01:00',
      breaks: [],
    });
  });

  it('reads each gap between two windows as a break, since the hours subtract their breaks', () => {
    const day = workdayOf(
      [window('08:00', '11:30'), window('12:15', '14:00'), window('14:30', '17:00')],
      BERLIN,
    );

    expect(day?.breaks).toEqual([
      { start: '2027-01-15T11:30:00+01:00', end: '2027-01-15T12:15:00+01:00' },
      { start: '2027-01-15T14:00:00+01:00', end: '2027-01-15T14:30:00+01:00' },
    ]);
    expect(day?.start).toBe('2027-01-15T08:00:00+01:00');
    expect(day?.end).toBe('2027-01-15T17:00:00+01:00');
  });
});
