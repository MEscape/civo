import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { parseInstant } from '../../domain/time/instant';
import { daysBetween, parseLocalDate } from '../../domain/time/local-date';
import { createInterval } from '../../domain/time/time-interval';

import type { Instant } from '../../domain/time/instant';
import type { LocalDateRange } from '../../domain/time/local-date-range';
import type { TimeInterval } from '../../domain/time/time-interval';

/** A start the caller picked: ISO-8601 with its offset. */
export function parseStart(raw: string): AppResult<Instant, ValidationAppError> {
  const start = parseInstant(raw);
  return start === null ? err(fieldValidationFailed('start', CODES.startInvalid)) : ok(start);
}

/** The days `from` to `to`, both included, as `YYYY-MM-DD`, at most `maxDays` of them. */
export function parseDateRange(
  raw: { readonly from: string; readonly to: string },
  maxDays: number,
): AppResult<LocalDateRange, ValidationAppError> {
  const from = parseLocalDate(raw.from);
  const to = parseLocalDate(raw.to);
  if (from === null) {
    return err(fieldValidationFailed('from', CODES.dateRangeInvalid));
  }
  if (to === null) {
    return err(fieldValidationFailed('to', CODES.dateRangeInvalid));
  }
  const days = daysBetween(from, to) + 1;
  if (days < 1) {
    return err(fieldValidationFailed('to', CODES.dateRangeInvalid));
  }
  if (days > maxDays) {
    return err(fieldValidationFailed('to', CODES.dateRangeTooLong));
  }
  return ok({ from, to });
}

/** A span of instants, `from` included and `to` not, at most `maxDays` days long. */
export function parseSpan(
  raw: { readonly from: string; readonly to: string },
  maxDays: number,
): AppResult<TimeInterval, ValidationAppError> {
  const from = parseInstant(raw.from);
  const to = parseInstant(raw.to);
  if (from === null) {
    return err(fieldValidationFailed('from', CODES.dateRangeInvalid));
  }
  if (to === null) {
    return err(fieldValidationFailed('to', CODES.dateRangeInvalid));
  }
  const span = createInterval(from, to);
  if (span === null) {
    return err(fieldValidationFailed('to', CODES.dateRangeInvalid));
  }
  if (span.end - span.start > maxDays * MS_PER_DAY) {
    return err(fieldValidationFailed('to', CODES.dateRangeTooLong));
  }
  return ok(span);
}
