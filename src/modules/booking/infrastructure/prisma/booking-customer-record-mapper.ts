import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isString, literalGuard, nullable, objectOf, optional } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { CHANGE_ACTORS, INFORMATION_FIELDS } from '../../domain/models/bookable-service';
import { normalizeEmail } from '../../domain/policies/customer-access';

import type { ChangeActor, InformationField } from '../../domain/models/bookable-service';
import type { BookingCustomer } from '../../domain/models/booking';

const isChangeActor = literalGuard(CHANGE_ACTORS);

/** A member the first version stored as `null` is simply absent. */
const isStoredCustomer = objectOf<Partial<Record<InformationField, string | null>>>({
  firstName: optional(nullable(isString)),
  lastName: optional(nullable(isString)),
  email: optional(nullable(isString)),
  phone: optional(nullable(isString)),
  referenceNumber: optional(nullable(isString)),
  notes: optional(nullable(isString)),
});

export function readCustomer(
  raw: unknown,
): AppResult<BookingCustomer | null, InfrastructureAppError> {
  if (raw === null) {
    return ok(null);
  }
  if (!isStoredCustomer(raw)) {
    return err(bookingDataInvalid('customer'));
  }
  const customer: Partial<Record<InformationField, string>> = {};
  for (const field of INFORMATION_FIELDS) {
    const value = raw[field];
    if (value !== undefined && value !== null) {
      customer[field] = value;
    }
  }
  return ok(customer);
}

/**
 * `staff` is what the first version stored for "an employee or a manager" (BD-10). As the one who
 * cancelled, the stricter reading is a manager.
 */
export function readCanceller(
  raw: string | null,
): AppResult<ChangeActor | null, InfrastructureAppError> {
  if (raw === null) {
    return ok(null);
  }
  const name = raw === 'staff' ? 'manager' : raw;
  return isChangeActor(name) ? ok(name) : err(bookingDataInvalid('cancelledBy'));
}

/** The e-mail a visitor can be found by, as the rules compare it. */
export function customerEmailOf(customer: BookingCustomer | null): string | null {
  return normalizeEmail(customer?.email);
}
