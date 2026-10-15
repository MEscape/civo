import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';

/**
 * An employee's resource is theirs: they make it and keep it (`SaveOwnProfile`).
 * Whoever sets the system up adds rooms, pitches and equipment, never people:
 * nobody is assigned to an employee resource from outside, and nobody else
 * sets an employee's hours.
 */
export function refuseEmployeeResource<
  T extends { readonly type: string; readonly assignedActorId?: string | null | undefined },
>(input: T): AppResult<T, ValidationAppError> {
  const isEmployee =
    input.type === 'employee' ||
    (input.assignedActorId !== undefined &&
      input.assignedActorId !== null &&
      input.assignedActorId.trim() !== '');
  return isEmployee
    ? err(fieldValidationFailed('type', BOOKING_VALIDATION_CODES.employeeSelfManaged))
    : ok(input);
}
