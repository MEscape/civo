import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { ok, err } from '@lib/result';
import type { AppResult } from '@lib/result';

import { BOOKING_VALIDATION_CODES as CODES, createBookingErrorBag } from '../errors/booking-errors';

import { blankToNull } from './text';

import type { BookableService, InformationField } from './bookable-service';

export const CUSTOMER_LIMITS = {
  nameMax: 80,
  emailMax: 254,
  phoneMax: 40,
  referenceNumberMax: 60,
  notesMax: 1000,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-.\s/]+$/;

/**
 * The details a visitor entered. Only what the service asked for is kept:
 * anything else in the request is dropped, so a booking never stores personal
 * data nobody needed.
 */
export interface BookingCustomer {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string;
  readonly phone: string | null;
  readonly referenceNumber: string | null;
  readonly notes: string | null;
}

/** The raw request values, by field. Untrusted until `createBookingCustomer` has run. */
export type BookingCustomerInput = Readonly<Partial<Record<InformationField, string>>>;

const MAX_LENGTH_BY_FIELD = {
  firstName: CUSTOMER_LIMITS.nameMax,
  lastName: CUSTOMER_LIMITS.nameMax,
  email: CUSTOMER_LIMITS.emailMax,
  phone: CUSTOMER_LIMITS.phoneMax,
  referenceNumber: CUSTOMER_LIMITS.referenceNumberMax,
  notes: CUSTOMER_LIMITS.notesMax,
} as const satisfies Record<InformationField, number>;

function checkFormat(field: InformationField, value: string, bag: FieldErrorBag): void {
  if (value.length > MAX_LENGTH_BY_FIELD[field]) {
    bag.add(field, CODES.textTooLong);
  } else if (field === 'email' && !EMAIL_PATTERN.test(value)) {
    bag.add(field, CODES.emailInvalid);
  } else if (field === 'phone' && !PHONE_PATTERN.test(value)) {
    bag.add(field, CODES.fieldRequired);
  }
}

/** One lower-case spelling of an address, used to match the booker when they come back. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** One submitted field: `null` when it is blank (and an error when it was required), else its checked value. */
function readField(
  { field, isRequired }: { readonly field: InformationField; readonly isRequired: boolean },
  input: BookingCustomerInput,
  bag: FieldErrorBag,
): string | null {
  const value = blankToNull(input[field]);
  if (value === null) {
    if (isRequired) {
      bag.add(field, CODES.fieldRequired);
    }
    return null;
  }
  checkFormat(field, value, bag);
  return field === 'email' ? normalizeEmail(value) : value;
}

/** Validates the visitor's details against what the service asks for. */
export function createBookingCustomer(
  service: BookableService,
  input: BookingCustomerInput,
): AppResult<BookingCustomer, ValidationAppError> {
  const bag = createBookingErrorBag();
  const values: Partial<Record<InformationField, string>> = {};

  for (const requirement of service.information) {
    const value = readField(requirement, input, bag);
    if (value !== null) {
      values[requirement.field] = value;
    }
  }

  const email = values.email;
  if (email === undefined && !bag.hasErrors) {
    bag.add('email', CODES.emailRequired);
  }
  if (bag.hasErrors || email === undefined) {
    return err(bag.toError());
  }

  return ok({
    firstName: values.firstName ?? null,
    lastName: values.lastName ?? null,
    email,
    phone: values.phone ?? null,
    referenceNumber: values.referenceNumber ?? null,
    notes: values.notes ?? null,
  });
}
