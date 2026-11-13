import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { arrayOf, isString, objectOf } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { toBookingLocationId } from '../../domain/models/ids';
import { formatLocalDate, parseLocalDate } from '../../domain/time/local-date';

import type { CoverageSpell } from '../../domain/models/employee-coverage';

interface StoredSpell {
  readonly locationId: string;
  readonly from: string;
  readonly to: string;
}

const isStoredSpell = objectOf<StoredSpell>({ locationId: isString, from: isString, to: isString });
const isStoredList = arrayOf(isStoredSpell);

/** The spells a calendar keeps, or none (`null`); a value that is not a list of spells is refused. */
export function readCoverage(value: unknown): AppResult<CoverageSpell[], InfrastructureAppError> {
  if (value === null || value === undefined) {
    return ok([]);
  }
  if (!isStoredList(value)) {
    return err(bookingDataInvalid('coverage'));
  }
  const spells: CoverageSpell[] = [];
  for (const stored of value) {
    const from = parseLocalDate(stored.from);
    const to = parseLocalDate(stored.to);
    if (from === null || to === null) {
      return err(bookingDataInvalid('coverage'));
    }
    spells.push({ locationId: toBookingLocationId(stored.locationId), from, to });
  }
  return ok(spells);
}

/** What the column holds: the list, or `null` for none. */
export function writeCoverage(spells: readonly CoverageSpell[]): StoredSpell[] | null {
  return spells.length === 0
    ? null
    : spells.map((spell) => ({
        locationId: spell.locationId,
        from: formatLocalDate(spell.from),
        to: formatLocalDate(spell.to),
      }));
}
