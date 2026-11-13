import { describe, expect, it } from 'vitest';

import { parseCoverage } from '@modules/booking/application/services/parse-coverage';
import { workingWindowsOf } from '@modules/booking/application/services/scheduling-context';
import { servesLocation } from '@modules/booking/domain/models/bookable-resource';
import { isWorkingAt } from '@modules/booking/domain/models/employee-coverage';
import type { CoverageSpell } from '@modules/booking/domain/models/employee-coverage';
import { toBookingLocationId } from '@modules/booking/domain/models/ids';
import type { WeeklyHours } from '@modules/booking/domain/scheduling/weekly-hours';
import { createLocalDateRange } from '@modules/booking/domain/time/local-date-range';

import { LOCATION, MONDAY, OTHER_LOCATION, employee } from '../support/booking-fixtures';
import { BERLIN, between, day } from '../support/time-fixtures';

const FRIDAY = '2027-01-15';
const TUESDAY = '2027-01-12';
const WEDNESDAY = '2027-01-13';

const EIGHT_TO_FIVE = { ranges: [{ startMinute: 8 * 60, endMinute: 17 * 60 }], breaks: [] };
const CLOSED = { ranges: [], breaks: [] };
const WEEK: WeeklyHours = {
  1: EIGHT_TO_FIVE,
  2: EIGHT_TO_FIVE,
  3: EIGHT_TO_FIVE,
  4: EIGHT_TO_FIVE,
  5: EIGHT_TO_FIVE,
  6: CLOSED,
  7: CLOSED,
};

const place = (id: typeof LOCATION) => ({
  id,
  zone: BERLIN,
  openingHours: { weekly: WEEK, exceptions: [] },
});
const HOME = place(LOCATION);
const ELSEWHERE = place(OTHER_LOCATION);

const away: CoverageSpell = {
  locationId: OTHER_LOCATION,
  from: day(TUESDAY),
  to: day(WEDNESDAY),
};
const range = createLocalDateRange(day(MONDAY), day(FRIDAY), 62)!;
const person = employee('anna', { coverage: [away] });

describe('where a person works on a day', () => {
  it('is their own location, except on the days a spell sends them elsewhere', () => {
    expect(isWorkingAt(person, LOCATION, day(MONDAY))).toBe(true);
    expect(isWorkingAt(person, OTHER_LOCATION, day(MONDAY))).toBe(false);
    expect(isWorkingAt(person, LOCATION, day(TUESDAY))).toBe(false);
    expect(isWorkingAt(person, OTHER_LOCATION, day(WEDNESDAY))).toBe(true);
    expect(isWorkingAt(person, LOCATION, day(FRIDAY))).toBe(true);
  });

  it('is everywhere for a resource that belongs to no location', () => {
    const shared = employee('room', { locationId: null });

    expect(isWorkingAt(shared, OTHER_LOCATION, day(TUESDAY))).toBe(true);
  });

  it('lets a location serve the person who is sent there, and no other', () => {
    expect(servesLocation(person, OTHER_LOCATION)).toBe(true);
    expect(servesLocation(employee('ben'), OTHER_LOCATION)).toBe(false);
    expect(servesLocation(person, toBookingLocationId('loc-third'))).toBe(false);
  });
});

describe('when a person works at a location', () => {
  it('is only the days they are there, inside the location’s hours', () => {
    const home = workingWindowsOf(person, HOME, range);
    const elsewhere = workingWindowsOf(person, ELSEWHERE, range);

    expect(home).toEqual([
      between(MONDAY, '08:00', '17:00'),
      between('2027-01-14', '08:00', '17:00'),
      between(FRIDAY, '08:00', '17:00'),
    ]);
    expect(elsewhere).toEqual([
      between(TUESDAY, '08:00', '17:00'),
      between(WEDNESDAY, '08:00', '17:00'),
    ]);
  });

  it('keeps the person’s own hours wherever they are sent', () => {
    const mornings = {
      weekly: { ...WEEK, 2: { ranges: [{ startMinute: 8 * 60, endMinute: 12 * 60 }], breaks: [] } },
      exceptions: [],
    };
    const windows = workingWindowsOf(
      employee('anna', { coverage: [away], availability: mornings }),
      ELSEWHERE,
      range,
    );

    expect(windows[0]).toEqual(between(TUESDAY, '08:00', '12:00'));
  });

  it('is unchanged for a person who is never sent anywhere', () => {
    // Whether a location may use them at all is the pool's question (`servesLocation`), not the schedule's.
    expect(workingWindowsOf(employee('ben'), HOME, range)).toHaveLength(5);
  });
});

describe('where a manager sends someone', () => {
  const rules = { home: LOCATION, locationIds: new Set([LOCATION, OTHER_LOCATION, 'loc-third']) };
  const spell = (locationId: string, from: string, to: string) => ({ locationId, from, to });

  it('reads the spells in the order of their days', () => {
    const read = parseCoverage(
      [spell('loc-third', FRIDAY, FRIDAY), spell(OTHER_LOCATION, TUESDAY, WEDNESDAY)],
      rules,
    )._unsafeUnwrap();

    expect(read.map((entry) => entry.locationId)).toEqual([OTHER_LOCATION, 'loc-third']);
  });

  it.each([
    ['their own location', spell(LOCATION, TUESDAY, TUESDAY), 'coverage.0.locationId'],
    ['a location that does not exist', spell('nowhere', TUESDAY, TUESDAY), 'coverage.0.locationId'],
    ['a day that is not one', spell(OTHER_LOCATION, '2027-02-30', TUESDAY), 'coverage.0.from'],
    ['days in the wrong order', spell(OTHER_LOCATION, WEDNESDAY, TUESDAY), 'coverage.0.to'],
  ])('refuses %s, at its field', (_name, entry, path) => {
    const error = parseCoverage([entry], rules)._unsafeUnwrapErr();

    expect(Object.keys(error.fieldErrors)).toContain(path);
  });

  it('refuses two spells on one day, naming both, because a person is in one place at a time', () => {
    const error = parseCoverage(
      [spell(OTHER_LOCATION, TUESDAY, WEDNESDAY), spell('loc-third', WEDNESDAY, FRIDAY)],
      rules,
    )._unsafeUnwrapErr();

    expect(Object.keys(error.fieldErrors)).toEqual(['coverage.0.from', 'coverage.1.from']);
  });

  it('names the right row when an earlier one does not read', () => {
    const error = parseCoverage(
      [spell('nowhere', TUESDAY, TUESDAY), spell(OTHER_LOCATION, WEDNESDAY, WEDNESDAY)],
      rules,
    )._unsafeUnwrapErr();

    expect(Object.keys(error.fieldErrors)).toEqual(['coverage.0.locationId']);
  });
});
