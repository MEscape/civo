import {
  BOOKING_VALIDATION_CODES as CODES,
  CUSTOMER_LIMITS,
} from '../../application/contracts/booking-constraints';

import type { InformationField } from '../../application/contracts/booking-constraints';
import type { PublicServiceDto } from '../dto/catalog-dto';

/**
 * The same checks the server makes on the booking form, run first in the
 * browser so a typo is caught without a round trip. The server repeats them:
 * this only saves the visitor time and is never trusted.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-.\s/]+$/;

const MAX_LENGTH: Readonly<Record<InformationField, number>> = {
  firstName: CUSTOMER_LIMITS.nameMax,
  lastName: CUSTOMER_LIMITS.nameMax,
  email: CUSTOMER_LIMITS.emailMax,
  phone: CUSTOMER_LIMITS.phoneMax,
  referenceNumber: CUSTOMER_LIMITS.referenceNumberMax,
  notes: CUSTOMER_LIMITS.notesMax,
};

function checkValue(field: InformationField, value: string): string | null {
  if (value.length > MAX_LENGTH[field]) {
    return CODES.textTooLong;
  }
  if (field === 'email' && !EMAIL_PATTERN.test(value)) {
    return CODES.emailInvalid;
  }
  if (field === 'phone' && !PHONE_PATTERN.test(value)) {
    return CODES.fieldRequired;
  }
  return null;
}

/** Error codes by field name; empty when the details are acceptable. */
export function validateDetails(
  service: PublicServiceDto,
  values: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  for (const { field, isRequired } of service.information) {
    const value = (values[field] ?? '').trim();
    if (value === '') {
      if (isRequired) {
        errors[field] = field === 'email' ? CODES.emailRequired : CODES.fieldRequired;
      }
      continue;
    }
    const problem = checkValue(field, value);
    if (problem !== null) {
      errors[field] = problem;
    }
  }
  return errors;
}

/** The values to send: only what the service asks for, trimmed. */
export function collectDetails(
  service: PublicServiceDto,
  values: Readonly<Record<string, string>>,
): Record<string, string> {
  const collected: Record<string, string> = {};
  for (const { field } of service.information) {
    const value = (values[field] ?? '').trim();
    if (value !== '') {
      collected[field] = value;
    }
  }
  return collected;
}
