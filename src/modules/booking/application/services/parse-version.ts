import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { parseInstant } from '../../domain/time/instant';

import type { Instant } from '../../domain/time/instant';

/** The version a change names (an ISO-8601 instant, as a view carries it), or a refusal at that field. */
export function parseVersion(field: string, text: string): AppResult<Instant, ValidationAppError> {
  const version = parseInstant(text);
  return version === null ? err(fieldValidationFailed(field, CODES.idInvalid)) : ok(version);
}
