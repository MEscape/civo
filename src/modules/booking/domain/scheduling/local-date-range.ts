import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { BOOKING_VALIDATION_CODES, bookingValidationFailed } from '../errors/booking-errors';
import { compareLocalDates, daysBetween, parseLocalDate } from '../time/local-date';

import type { LocalDateRange } from './scheduling-types';

/**
 * A request's `from`/`to` days. Both included, `from` not after `to`, and no
 * longer than `maxDays`: an unbounded range is an unbounded query.
 */
export function parseLocalDateRange(
  from: string,
  to: string,
  maxDays: number,
): AppResult<LocalDateRange, ValidationAppError> {
  const first = parseLocalDate(from);
  const last = parseLocalDate(to);
  const fieldErrors: Record<string, string[]> = {};
  if (first === null) {
    fieldErrors['from'] = [BOOKING_VALIDATION_CODES.dateInvalid];
  }
  if (last === null) {
    fieldErrors['to'] = [BOOKING_VALIDATION_CODES.dateInvalid];
  }
  if (first === null || last === null) {
    return err(bookingValidationFailed(fieldErrors));
  }
  if (compareLocalDates(first, last) > 0) {
    return err(bookingValidationFailed({ to: [BOOKING_VALIDATION_CODES.dateRangeInvalid] }));
  }
  if (daysBetween(first, last) + 1 > maxDays) {
    return err(bookingValidationFailed({ to: [BOOKING_VALIDATION_CODES.dateRangeTooLong] }));
  }
  return ok({ from: first, to: last });
}
