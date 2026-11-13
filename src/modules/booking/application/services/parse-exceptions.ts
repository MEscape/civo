import type { FieldErrorBag } from '@lib/errors';

import { BOOKING_VALIDATION_CODES as CODES } from '../../domain/errors/booking-errors';
import { EXCEPTION_KINDS } from '../../domain/scheduling/availability-plan';
import { CLOSED_DAY } from '../../domain/scheduling/weekly-hours';
import { daysBetween, parseLocalDate } from '../../domain/time/local-date';
import { LOCATION_LIMITS as LIMITS } from '../contracts/booking-constraints';

import { parseDay } from './parse-hours';

import type { AvailabilityException } from '../../domain/scheduling/availability-plan';
import type { ExceptionInput } from '../contracts/location-inputs';

function parseException(
  exception: ExceptionInput,
  path: string,
  bag: FieldErrorBag,
): AvailabilityException | null {
  const from = parseLocalDate(exception.from);
  const to = parseLocalDate(exception.to);
  const kind = EXCEPTION_KINDS.find((candidate) => candidate === exception.kind);
  bag.expect(kind !== undefined, `${path}.kind`, CODES.exceptionInvalid);
  bag.expect(from !== null, `${path}.from`, CODES.exceptionInvalid);
  bag.expect(to !== null, `${path}.to`, CODES.exceptionInvalid);
  if (kind === undefined || from === null || to === null) {
    return null;
  }
  const days = daysBetween(from, to) + 1;
  if (
    !bag.expect(days >= 1 && days <= LIMITS.exceptionDaysMax, `${path}.to`, CODES.exceptionInvalid)
  ) {
    return null;
  }
  if (kind === 'closed') {
    return { kind, from, to, day: CLOSED_DAY };
  }
  const given = exception.day ?? { intervals: [], breaks: [] };
  // Other hours or extra hours without any hours say nothing; a closure is what "no hours" means.
  bag.expect(given.intervals.length > 0, `${path}.day.intervals`, CODES.exceptionInvalid);
  return { kind, from, to, day: parseDay(given, `${path}.day`, bag) };
}

/**
 * Two exceptions with other hours on the same day leave the engine to pick one; the manager is told
 * instead. Closures and extra hours may overlap: a closure wins by definition and extra hours add up.
 */
function rejectOverlappingOverrides(
  parsed: ReadonlyArray<{ readonly index: number; readonly exception: AvailabilityException }>,
  bag: FieldErrorBag,
): void {
  const overrides = parsed
    .filter(({ exception }) => exception.kind === 'override')
    .sort((a, b) => daysBetween(b.exception.from, a.exception.from));
  let reach: AvailabilityException['to'] | null = null;
  for (const { index, exception } of overrides) {
    if (reach !== null && daysBetween(exception.from, reach) >= 0) {
      bag.add(`openingHours.exceptions.${index}.from`, CODES.exceptionsOverlap);
    }
    reach = reach === null || daysBetween(reach, exception.to) > 0 ? exception.to : reach;
  }
}

export function parseExceptions(
  exceptions: readonly ExceptionInput[],
  bag: FieldErrorBag,
): AvailabilityException[] {
  if (
    !bag.expect(exceptions.length <= LIMITS.exceptionsMax, 'openingHours.exceptions', CODES.tooMany)
  ) {
    return [];
  }
  const parsed = exceptions.flatMap((exception, index) => {
    const read = parseException(exception, `openingHours.exceptions.${index}`, bag);
    return read === null ? [] : [{ index, exception: read }];
  });
  rejectOverlappingOverrides(parsed, bag);
  return parsed
    .map(({ exception }) => exception)
    .sort(
      (a, b) =>
        daysBetween(b.from, a.from) || daysBetween(b.to, a.to) || a.kind.localeCompare(b.kind),
    );
}
