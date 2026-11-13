import { describe, expect, it } from 'vitest';

import { toBookingLocationId } from '@modules/booking/domain/models/ids';
import { parseLocalDate } from '@modules/booking/domain/time/local-date';
import {
  readCoverage,
  writeCoverage,
} from '@modules/booking/infrastructure/prisma/coverage-record-mapper';

const spell = {
  locationId: toBookingLocationId('loc-2'),
  from: parseLocalDate('2027-02-01')!,
  to: parseLocalDate('2027-02-03')!,
};

describe('the cover a calendar keeps', () => {
  it('is none when the column is empty', () => {
    expect(readCoverage(null)._unsafeUnwrap()).toEqual([]);
    expect(writeCoverage([])).toBeNull();
  });

  it('is written as ISO days and read back as the same spells', () => {
    const stored = writeCoverage([spell]);

    expect(stored).toEqual([{ locationId: 'loc-2', from: '2027-02-01', to: '2027-02-03' }]);
    expect(readCoverage(stored)._unsafeUnwrap()).toEqual([spell]);
  });

  it.each([
    ['something that is not a list', { locationId: 'loc-2' }],
    ['a spell with no days', [{ locationId: 'loc-2' }]],
    ['a day that is not one', [{ locationId: 'loc-2', from: '2027-02-30', to: '2027-03-01' }]],
  ])('refuses %s as unreadable stored data', (_name, value) => {
    expect(readCoverage(value)._unsafeUnwrapErr()).toMatchObject({ kind: 'infrastructure' });
  });
});
