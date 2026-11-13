import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isDefined } from '@lib/utils';

import {
  BOOKING_VALIDATION_CODES as CODES,
  createBookingErrorBag,
} from '../../domain/errors/booking-errors';
import { MAX_COVERAGE_SPELLS, spellsOverlap } from '../../domain/models/employee-coverage';
import { toBookingLocationId } from '../../domain/models/ids';
import { daysBetween, parseLocalDate } from '../../domain/time/local-date';
import { LOCATION_LIMITS } from '../contracts/booking-constraints';

import type { CoverageSpell } from '../../domain/models/employee-coverage';
import type { CoverageInput } from '../contracts/team-inputs';

const PATH = 'coverage';

/**
 * Where a manager sends an employee for some days, read by the path the form uses. The other location
 * must exist in the website and be another than the employee's own; the days are real, in order and not
 * longer than an absence may be; and no two spells share a day, because a person is in one place on a day.
 */
export function parseCoverage(
  list: readonly CoverageInput[],
  known: { readonly home: string; readonly locationIds: ReadonlySet<string> },
): AppResult<CoverageSpell[], ValidationAppError> {
  const bag = createBookingErrorBag();
  if (!bag.expect(list.length <= MAX_COVERAGE_SPELLS, PATH, CODES.tooMany)) {
    return err(bag.toError());
  }
  // One entry per place in the list (`undefined` where it does not read), so a refusal names the right row.
  const read = list.map((entry, index): CoverageSpell | undefined => {
    const from = parseLocalDate(entry.from);
    const to = parseLocalDate(entry.to);
    const isPlace = known.locationIds.has(entry.locationId) && entry.locationId !== known.home;
    bag.expect(isPlace, `${PATH}.${index}.locationId`, CODES.idInvalid);
    bag.expect(from !== null, `${PATH}.${index}.from`, CODES.dateRangeInvalid);
    bag.expect(to !== null, `${PATH}.${index}.to`, CODES.dateRangeInvalid);
    if (!isPlace || from === null || to === null) {
      return undefined;
    }
    const days = daysBetween(from, to) + 1;
    const isInOrder = bag.expect(days >= 1, `${PATH}.${index}.to`, CODES.dateRangeInvalid);
    const isShortEnough =
      isInOrder &&
      bag.expect(
        days <= LOCATION_LIMITS.exceptionDaysMax,
        `${PATH}.${index}.to`,
        CODES.dateRangeTooLong,
      );
    return isShortEnough
      ? { locationId: toBookingLocationId(entry.locationId), from, to }
      : undefined;
  });
  read.forEach((spell, index) => {
    // Both rows of an overlapping pair are named, so the one being changed is the one that is told.
    const overlaps = read.some(
      (other, otherIndex) =>
        spell !== undefined &&
        other !== undefined &&
        otherIndex !== index &&
        spellsOverlap(spell, other),
    );
    bag.expect(!overlaps, `${PATH}.${index}.from`, CODES.coverageOverlap);
  });
  const spells = read.filter(isDefined);
  return bag.hasErrors
    ? err(bag.toError())
    : ok(spells.sort((a, b) => daysBetween(b.from, a.from)));
}
