import { describe, expect, it } from 'vitest';

import { windowsForDate } from '@modules/booking/domain/scheduling/availability-windows';
import { assessSlot } from '@modules/booking/domain/scheduling/slot-assessment';
import { findAvailableSlots } from '@modules/booking/domain/scheduling/slot-finder';
import {
  addDays,
  parseLocalDate,
  formatLocalDate,
  weekdayOf,
} from '@modules/booking/domain/time/local-date';
import { parseTimeOfDay } from '@modules/booking/domain/time/time-of-day';
import {
  epochToZonedWallClock,
  parseTimeZone,
  zonedTimeToEpoch,
} from '@modules/booking/domain/time/time-zone';

import {
  BERLIN,
  NEW_YORK,
  NOW,
  at,
  date,
  hours,
  indexFor,
  makeLocation,
  makeService,
  plan,
  range,
  times,
  weekdays,
} from '../support/fixtures';

const HOUR = 3_600_000;

describe('local dates', () => {
  it('rejects dates that do not exist', () => {
    expect(parseLocalDate('2027-02-29')).toBeNull();
    expect(parseLocalDate('2028-02-29')).not.toBeNull();
    expect(parseLocalDate('2027-13-01')).toBeNull();
    expect(parseLocalDate('27-01-01')).toBeNull();
  });

  it('does calendar arithmetic across month and year ends', () => {
    expect(formatLocalDate(addDays(date('2027-12-31'), 1))).toBe('2028-01-01');
    expect(formatLocalDate(addDays(date('2028-03-01'), -1))).toBe('2028-02-29');
  });

  it('numbers weekdays from Monday = 1', () => {
    expect(weekdayOf(date('2027-01-11'))).toBe(1);
    expect(weekdayOf(date('2027-01-17'))).toBe(7);
  });

  it('parses times of day', () => {
    expect(parseTimeOfDay('09:30')).toBe(570);
    expect(parseTimeOfDay('24:00')).toBe(1440);
    expect(parseTimeOfDay('25:00')).toBeNull();
    expect(parseTimeOfDay('9:30')).toBeNull();
  });

  it('accepts only real time zones', () => {
    expect(parseTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
    expect(parseTimeZone('Mars/Olympus')).toBeNull();
  });
});

describe('zones', () => {
  it('converts a wall-clock time to an instant with the zone offset of that date', () => {
    expect(new Date(at('2027-01-11', '09:00')).toISOString()).toBe('2027-01-11T08:00:00.000Z');
    expect(new Date(at('2027-07-12', '09:00')).toISOString()).toBe('2027-07-12T07:00:00.000Z');
    expect(new Date(at('2027-01-11', '09:00', NEW_YORK)).toISOString()).toBe(
      '2027-01-11T14:00:00.000Z',
    );
  });

  it('round-trips a normal wall-clock time', () => {
    const instant = at('2027-06-01', '13:45');
    expect(epochToZonedWallClock(instant, BERLIN)).toEqual({
      date: date('2027-06-01'),
      minuteOfDay: 825,
    });
  });

  it('moves a time that falls in the spring gap forward', () => {
    // 2027-03-28 02:30 does not exist in Berlin.
    const instant = zonedTimeToEpoch(date('2027-03-28'), 150, BERLIN);
    expect(new Date(instant).toISOString()).toBe('2027-03-28T01:30:00.000Z');
    expect(epochToZonedWallClock(instant, BERLIN).minuteOfDay).toBe(210);
  });

  it('takes the earlier instant of an autumn overlap', () => {
    // 2027-10-31 02:30 happens twice in Berlin; the first is CEST (00:30Z).
    expect(new Date(zonedTimeToEpoch(date('2027-10-31'), 150, BERLIN)).toISOString()).toBe(
      '2027-10-31T00:30:00.000Z',
    );
  });
});

describe('availability windows', () => {
  it('turns a wall-clock day into instants of the location zone', () => {
    const windows = windowsForDate(weekdays('09:00', '10:00'), date('2027-01-11'), BERLIN);
    expect(windows).toEqual([{ start: at('2027-01-11', '09:00'), end: at('2027-01-11', '10:00') }]);
  });

  it('subtracts breaks', () => {
    const windows = windowsForDate(
      weekdays('09:00', '12:00', [{ start: '10:00', end: '10:30' }]),
      date('2027-01-11'),
      BERLIN,
    );
    expect(windows).toEqual([
      { start: at('2027-01-11', '09:00'), end: at('2027-01-11', '10:00') },
      { start: at('2027-01-11', '10:30'), end: at('2027-01-11', '12:00') },
    ]);
  });

  it('lets a later exception win over an earlier one for the same date', () => {
    const p = plan({ 1: hours('08:00', '18:00') }, [
      { kind: 'override', from: '2027-01-11', to: '2027-01-11', day: hours('09:00', '10:00') },
      { kind: 'override', from: '2027-01-11', to: '2027-01-11', day: hours('13:00', '14:00') },
    ]);
    expect(windowsForDate(p, date('2027-01-11'), BERLIN)).toEqual([
      { start: at('2027-01-11', '13:00'), end: at('2027-01-11', '14:00') },
    ]);
  });

  it('closed beats everything on its dates', () => {
    const p = plan({ 1: hours('08:00', '18:00') }, [
      { kind: 'additional', from: '2027-01-11', to: '2027-01-11', day: hours('19:00', '20:00') },
      { kind: 'closed', from: '2027-01-10', to: '2027-01-12' },
    ]);
    expect(windowsForDate(p, date('2027-01-11'), BERLIN)).toEqual([]);
  });
});

describe('daylight saving time', () => {
  const night = {
    location: makeLocation({ openingHours: plan({ 7: hours('01:00', '05:00') }) }),
    service: makeService({ durationMinutes: 30, slotIntervalMinutes: 30, horizonDays: 400 }),
  };

  it('skips wall-clock times that do not exist on the spring-forward day', () => {
    const index = indexFor(night, range('2027-03-28', '2027-03-28'));
    expect(times(findAvailableSlots(index))).toEqual([
      '01:00',
      '01:30',
      '03:00',
      '03:30',
      '04:00',
      '04:30',
    ]);
  });

  it('offers exactly the real hours on the spring-forward day', () => {
    const slots = findAvailableSlots(indexFor(night, range('2027-03-28', '2027-03-28')));
    expect(slots).toHaveLength(6); // 01:00-05:00 wall clock is only three real hours
    const total = slots.reduce((sum, slot) => sum + (slot.end - slot.start), 0);
    expect(total).toBe(3 * HOUR);
  });

  it('offers each repeated wall-clock time once on the fall-back day', () => {
    const index = indexFor(night, range('2027-10-31', '2027-10-31'));
    const slots = findAvailableSlots(index);
    expect(times(slots)).toEqual([
      '01:00',
      '01:30',
      '02:00',
      '02:30',
      '03:00',
      '03:30',
      '04:00',
      '04:30',
    ]);
    expect(new Set(slots.map((slot) => slot.start)).size).toBe(slots.length);
  });

  it('measures an appointment in elapsed time across the gap', () => {
    const service = makeService({ durationMinutes: 60, slotIntervalMinutes: 30, horizonDays: 400 });
    const index = indexFor({ ...night, service }, range('2027-03-28', '2027-03-28'));
    const slot = findAvailableSlots(index).find((candidate) => times([candidate])[0] === '01:30');
    expect(slot).toBeDefined();
    expect((slot?.end ?? 0) - (slot?.start ?? 0)).toBe(HOUR);
    expect(times([{ start: slot?.end ?? 0 }])).toEqual(['03:30']);
  });

  it('treats a time inside the gap as the first real time after it, never as a second slot', () => {
    const spring = indexFor(night, range('2027-03-28', '2027-03-28'));
    const nonexistent = zonedTimeToEpoch(date('2027-03-28'), 150, BERLIN);
    expect(times([{ start: nonexistent }])).toEqual(['03:30']);
    expect(assessSlot(spring, nonexistent, 1).kind).toBe('planned');
  });

  it('rejects the repeated second hour of the autumn change', () => {
    const autumn = indexFor(night, range('2027-10-31', '2027-10-31'));
    const secondTwoThirty = new Date('2027-10-31T01:30:00Z').getTime(); // 02:30 CET, the repeat
    expect(assessSlot(autumn, secondTwoThirty, 1)).toMatchObject({ reason: 'off-grid' });
  });

  it('keeps ordinary days on either side unaffected', () => {
    const long = { service: makeService({ horizonDays: 400 }) };
    const before = indexFor(long, range('2027-03-26', '2027-03-26'));
    const after = indexFor(long, range('2027-03-29', '2027-03-29'));
    expect(times(findAvailableSlots(before))[0]).toBe('08:00');
    expect(times(findAvailableSlots(after))[0]).toBe('08:00');
    expect(findAvailableSlots(before)[0]?.start).toBe(at('2027-03-26', '08:00'));
    expect(findAvailableSlots(after)[0]?.start).toBe(at('2027-03-29', '08:00'));
  });

  it('applies the notice period in elapsed time', () => {
    const now = new Date(at('2027-03-28', '00:30'));
    const index = indexFor(
      { ...night, now, service: makeService({ noticeMinutes: 120, horizonDays: 400 }) },
      range('2027-03-28', '2027-03-28'),
    );
    // 00:30 CET + 2h elapsed = 03:30 CEST.
    expect(times(findAvailableSlots(index))[0]).toBe('03:30');
  });
});

describe('time zones', () => {
  it('computes slots in the zone of the location, whatever zone the server or visitor is in', () => {
    const berlin = findAvailableSlots(indexFor({}, range('2027-01-11', '2027-01-11')));
    const newYork = findAvailableSlots(
      indexFor(
        { location: makeLocation({ timeZone: NEW_YORK }) },
        range('2027-01-11', '2027-01-11'),
      ),
    );
    expect(times(berlin)[0]).toBe('08:00');
    expect(times(newYork, NEW_YORK)[0]).toBe('08:00');
    expect((newYork[0]?.start ?? 0) - (berlin[0]?.start ?? 0)).toBe(6 * HOUR);
  });

  it('judges the booking horizon by the location calendar day', () => {
    // 23:30 UTC on Jan 4 is already Jan 5 in Berlin.
    const now = new Date('2027-01-04T23:30:00Z');
    const index = indexFor(
      { now, service: makeService({ horizonDays: 1 }) },
      range('2027-01-05', '2027-01-08'),
    );
    const days = new Set(
      findAvailableSlots(index).map((slot) =>
        formatLocalDate(epochToZonedWallClock(slot.start, BERLIN).date),
      ),
    );
    expect([...days]).toEqual(['2027-01-05', '2027-01-06']);
    expect(NOW.getTime()).toBeLessThan(now.getTime());
  });
});
