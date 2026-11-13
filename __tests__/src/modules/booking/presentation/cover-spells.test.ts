import { describe, expect, it } from 'vitest';

import { comingSpells } from '@modules/booking/presentation/forms/cover-spells';

const spell = (from: string, to: string) => ({
  locationId: 'loc-2',
  locationName: 'Bürgerbüro West',
  from,
  to,
});
const TODAY = '2027-02-01';

describe('the spells of cover that are coming up', () => {
  it('keeps those that are on today or start within the days ahead, soonest first', () => {
    const coming = comingSpells(
      [
        spell('2027-02-10', '2027-02-11'),
        spell('2027-01-30', '2027-02-02'),
        spell('2027-02-20', '2027-02-21'),
        spell('2027-01-10', '2027-01-12'),
      ],
      TODAY,
      14,
    );

    expect(coming.map(({ from }) => from)).toEqual(['2027-01-30', '2027-02-10']);
  });

  it('is empty when nothing is coming', () => {
    expect(comingSpells([], TODAY, 7)).toEqual([]);
  });
});
