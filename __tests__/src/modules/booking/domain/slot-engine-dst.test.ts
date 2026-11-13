import { describe, expect, it } from 'vitest';

import { assessSlot } from '@modules/booking/domain/scheduling/slot-engine';
import { createTimeRange, windowsForDate } from '@modules/booking/domain/scheduling/weekly-hours';
import { asInstant, instantToDate } from '@modules/booking/domain/time/instant';
import { resolveLocalTime } from '@modules/booking/domain/time/local-time-resolution';
import type { TimeZone } from '@modules/booking/domain/time/time-zone';

import { MONDAY, build, need, slotsOf, times, worker } from '../support/scheduling-fixtures';
import { BERLIN, NEW_YORK, at, clock, day } from '../support/time-fixtures';

describe('daylight saving', () => {
  const lateNight = (date: string, zone: TimeZone = BERLIN) => {
    const range = createTimeRange(0, 360);
    if (range === null) {
      throw new Error('fixture');
    }
    return windowsForDate({ ranges: [range], breaks: [] }, day(date), zone);
  };

  it('offers no start in the hour the clocks skip, and keeps the grid on the wall clock', () => {
    const open = lateNight('2027-03-28');
    const slots = slotsOf({
      range: ['2027-03-28', '2027-03-28'],
      open,
      requirements: [need(1, worker('anna', open))],
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });

    expect(times(slots)).toEqual([
      '00:00',
      '00:30',
      '01:00',
      '01:30',
      '03:00',
      '03:30',
      '04:00',
      '04:30',
      '05:00',
      '05:30',
    ]);
    // 01:30 and 03:00 are thirty real minutes apart: the hour in between never happened.
    expect(slots[4]?.start).toBe((slots[3]?.start ?? 0) + 30 * 60_000);
  });

  it('measures an appointment across the gap in elapsed time', () => {
    const open = lateNight('2027-03-28');
    const crossing = slotsOf({
      range: ['2027-03-28', '2027-03-28'],
      open,
      rules: { durationMinutes: 60, stepMinutes: 30 },
    }).find((slot) => clock(slot.start).endsWith('01:30'));

    expect(clock(crossing?.start ?? at('2027-03-28', '00:00'))).toBe('2027-03-28 01:30');
    expect(clock(crossing?.end ?? at('2027-03-28', '00:00'))).toBe('2027-03-28 03:30');
    expect((crossing?.end ?? 0) - (crossing?.start ?? 0)).toBe(60 * 60_000);
  });

  it('offers a repeated time once, at its first occurrence, in a day of 25 hours', () => {
    const open = lateNight('2027-10-31');
    const slots = slotsOf({
      range: ['2027-10-31', '2027-10-31'],
      open,
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });

    expect(times(slots)).toEqual([
      '00:00',
      '00:30',
      '01:00',
      '01:30',
      '02:00',
      '02:30',
      '03:00',
      '03:30',
      '04:00',
      '04:30',
      '05:00',
      '05:30',
    ]);
    const starts = slots.map((slot) => slot.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    // The first 02:00 is summer time (00:00 UTC); the 03:00 that follows is winter time (02:00 UTC).
    expect(instantToDate(slots[4]?.start ?? at(MONDAY, '00:00')).toISOString()).toBe(
      '2027-10-31T00:00:00.000Z',
    );
    expect(instantToDate(slots[6]?.start ?? at(MONDAY, '00:00')).toISOString()).toBe(
      '2027-10-31T02:00:00.000Z',
    );
  });

  it('refuses the second occurrence of the repeated time as off the grid', () => {
    const open = lateNight('2027-10-31');
    const scheduling = build({
      range: ['2027-10-31', '2027-10-31'],
      open,
      rules: { durationMinutes: 30, stepMinutes: 30 },
    });
    const resolution = resolveLocalTime(day('2027-10-31'), 150, BERLIN);

    expect(resolution.kind).toBe('ambiguous');
    if (resolution.kind !== 'ambiguous') {
      return;
    }
    expect(assessSlot(scheduling, resolution.first).kind).toBe('planned');
    expect(assessSlot(scheduling, resolution.second)).toEqual({
      kind: 'rejected',
      reason: 'off-grid',
    });
  });

  it('blocks a booking in the repeated hour by the real time it covers, not by the clock text', () => {
    const open = lateNight('2027-10-31');
    const resolution = resolveLocalTime(day('2027-10-31'), 150, BERLIN);
    if (resolution.kind !== 'ambiguous') {
      throw new Error('fixture');
    }
    const firstOccurrence = {
      start: resolution.first,
      end: asInstant(resolution.first + 30 * 60_000),
    };
    const slots = slotsOf({
      range: ['2027-10-31', '2027-10-31'],
      open,
      requirements: [need(1, worker('anna', open, [firstOccurrence]))],
      rules: { durationMinutes: 60, stepMinutes: 30 },
    });

    // The booking holds 02:30-03:00 summer time (00:30-01:00 UTC). An hour from 02:00 and from
    // 02:30 runs into it; an hour from 01:30 ends as it starts, and 03:00 winter time starts after.
    expect(times(slots)).toContain('01:30');
    expect(times(slots)).not.toContain('02:00');
    expect(times(slots)).not.toContain('02:30');
    expect(times(slots)).toContain('03:00');
  });

  it('puts the same local rules on other instants in another zone', () => {
    const berlinOpen = lateNight('2027-01-11');
    const newYorkOpen = lateNight('2027-01-11', NEW_YORK);
    const inBerlin = slotsOf({ range: [MONDAY, MONDAY], open: berlinOpen });
    const inNewYork = slotsOf({ range: [MONDAY, MONDAY], open: newYorkOpen, zone: NEW_YORK });

    expect(times(inBerlin)).toEqual(times(inNewYork, NEW_YORK));
    expect(inBerlin[0]?.start).not.toBe(inNewYork[0]?.start);
  });
});
