import { z } from 'zod';

import {
  BOOKING_ID_MAX_LENGTH,
  BOOKING_INPUT_LIMITS as LIMITS,
  BOOKING_VALIDATION_CODES as CODES,
  INFORMATION_FIELDS,
} from '../../application/contracts/booking-constraints';

import type {
  BookingCustomer,
  InformationField,
} from '../../application/contracts/booking-constraints';

/**
 * Field schemas shared by the actions. Messages are stable codes, never prose (the UI translates
 * them); limits come from the constants, so a number is defined exactly once. These check the SHAPE
 * and the size of untrusted text; what a value means is the use case's and the domain's to decide.
 */
export const idSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(BOOKING_ID_MAX_LENGTH, { message: CODES.idInvalid });

/** ISO-8601 with an offset; the use case parses it with the booking time model. */
export const instantSchema = z
  .string()
  .min(1, { message: CODES.startInvalid })
  .max(LIMITS.instantMax, { message: CODES.startInvalid });

/** A calendar day, `YYYY-MM-DD`. */
export const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: CODES.dateRangeInvalid });

export const emailSchema = z
  .string()
  .trim()
  .max(LIMITS.emailMax, { message: CODES.emailInvalid })
  .pipe(z.email({ message: CODES.emailInvalid }));

export const referenceSchema = z
  .string()
  .trim()
  .min(1, { message: CODES.referenceInvalid })
  .max(LIMITS.referenceMax, {
    message: CODES.referenceInvalid,
  });

export const requirementIndexSchema = z
  .number()
  .int({ message: CODES.idInvalid })
  .min(0, { message: CODES.idInvalid })
  .max(LIMITS.requirementIndexMax, { message: CODES.idInvalid });

const optionalText = (max: number) =>
  z.string().trim().max(max, { message: CODES.fieldRequired }).optional();

/**
 * What the booking form carries. A field left empty is the same as a field not sent, so the rules
 * see only what the person wrote.
 */
export const customerSchema = z
  .object({
    firstName: optionalText(LIMITS.nameMax),
    lastName: optionalText(LIMITS.nameMax),
    email: z.union([emailSchema, z.literal('')]).optional(),
    phone: optionalText(LIMITS.phoneMax),
    referenceNumber: optionalText(LIMITS.referenceNumberMax),
    notes: optionalText(LIMITS.notesMax),
  })
  .transform((customer): BookingCustomer => {
    const written: Partial<Record<InformationField, string>> = {};
    for (const field of INFORMATION_FIELDS) {
      const value = customer[field];
      if (value !== undefined && value !== '') {
        written[field] = value;
      }
    }
    return written;
  });
