import { describe, expect, it } from 'vitest';

import { timeZoneOptions } from '@modules/booking/presentation/forms/time-zone-options';

const ZONES = ['Europe/Berlin', 'Europe/Zurich', 'America/Berlin_Heights', 'Asia/Tokyo'];
const nameOf = (zone: string) => (zone === 'Asia/Tokyo' ? undefined : 'CEST');

describe('suggesting time zones', () => {
  it('suggests nothing for nothing typed', () => {
    expect(timeZoneOptions('  ', ZONES, nameOf)).toEqual([]);
  });

  it('finds zones by any part of their name, ignoring case, slashes and underscores', () => {
    expect(timeZoneOptions('berlin', ZONES, nameOf).map(({ value }) => value)).toEqual([
      'Europe/Berlin',
      'America/Berlin_Heights',
    ]);
    expect(timeZoneOptions('europe berlin', ZONES, nameOf)).toEqual([
      { value: 'Europe/Berlin', detail: 'CEST' },
    ]);
  });

  it('puts zones that start with the words before those that only contain them', () => {
    expect(timeZoneOptions('europe', ZONES, nameOf).map(({ value }) => value)).toEqual([
      'Europe/Berlin',
      'Europe/Zurich',
    ]);
    expect(
      timeZoneOptions('r', ['A/Br', 'R/X'], () => undefined).map(({ value }) => value),
    ).toEqual(['R/X', 'A/Br']);
  });

  it('leaves the name out for a zone that has none, and offers only a few', () => {
    expect(timeZoneOptions('tokyo', ZONES, nameOf)).toEqual([{ value: 'Asia/Tokyo' }]);
    const many = Array.from({ length: 30 }, (_, index) => `Zone/Place${String(index)}`);
    expect(timeZoneOptions('place', many, nameOf)).toHaveLength(8);
  });
});
