import { describe, expect, it } from 'vitest';

import {
  GERMAN_REGIONS,
  easterSunday,
  publicHolidaysOf,
} from '@modules/booking/domain/holidays/german-holidays';

const dates = (region: Parameters<typeof publicHolidaysOf>[0], year: number) =>
  Object.fromEntries(publicHolidaysOf(region, year).map((holiday) => [holiday.key, holiday.date]));

describe('Easter', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('falls on the known day in %i', (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe('public holidays', () => {
  it('counts the movable days from Easter', () => {
    expect(dates('DE', 2026)).toMatchObject({
      goodFriday: '2026-04-03',
      easterMonday: '2026-04-06',
      ascension: '2026-05-14',
      whitMonday: '2026-05-25',
    });
  });

  it('has nine nationwide holidays and nothing a single state keeps', () => {
    const national = publicHolidaysOf('DE', 2026);

    expect(national.map((holiday) => holiday.key)).toEqual([
      'newYear',
      'goodFriday',
      'easterMonday',
      'labourDay',
      'ascension',
      'whitMonday',
      'germanUnity',
      'christmasDay',
      'boxingDay',
    ]);
  });

  it('adds what a state keeps on top of the nationwide days', () => {
    const bavaria = dates('BY', 2026);
    const berlin = dates('BE', 2026);

    expect(bavaria).toMatchObject({
      epiphany: '2026-01-06',
      corpusChristi: '2026-06-04',
      allSaints: '2026-11-01',
    });
    expect(bavaria).not.toHaveProperty('womensDay');
    expect(berlin).toMatchObject({ womensDay: '2026-03-08' });
    expect(berlin).not.toHaveProperty('corpusChristi');
  });

  it('puts the Saxon day of repentance on the Wednesday before 23 November', () => {
    expect(dates('SN', 2026)['repentanceDay']).toBe('2026-11-18');
    expect(dates('SN', 2027)['repentanceDay']).toBe('2027-11-17');
    // 23 November 2022 was itself a Wednesday: the day is the one a week before, not that day.
    expect(dates('SN', 2022)['repentanceDay']).toBe('2022-11-16');
    expect(dates('SN', 2023)['repentanceDay']).toBe('2023-11-22');
  });

  it('lists Reformation Day for the northern and eastern states only', () => {
    expect(dates('HH', 2026)).toHaveProperty('reformationDay');
    expect(dates('BY', 2026)).not.toHaveProperty('reformationDay');
    expect(dates('BW', 2026)).not.toHaveProperty('reformationDay');
  });

  it('returns each region in date order, without duplicates', () => {
    for (const region of GERMAN_REGIONS) {
      const found = publicHolidaysOf(region, 2027).map((holiday) => holiday.date);
      expect([...found].sort()).toEqual(found);
      expect(new Set(found).size).toBe(found.length);
    }
  });

  it('gives every state at least the nationwide holidays', () => {
    for (const region of GERMAN_REGIONS) {
      expect(publicHolidaysOf(region, 2026).length).toBeGreaterThanOrEqual(9);
    }
  });
});
