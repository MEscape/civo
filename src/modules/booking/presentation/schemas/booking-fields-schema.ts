import { z } from 'zod';

import {
  BOOKING_REFERENCE_LENGTH,
  BOOKING_VALIDATION_CODES as CODES,
  CUSTOMER_LIMITS,
  INFORMATION_FIELDS,
  SERVICE_LIMITS,
} from '../../application/contracts/booking-constraints';

/**
 * Field-level building blocks shared by the action schemas. A schema only
 * checks the SHAPE of a request (type, length, a plausible format) so a
 * malformed one is refused before it reaches a use case; what a value MEANS
 * (does the service exist, is the time free) is decided by the use case.
 * Messages are stable codes, never prose (errors.md).
 */

const ID_MAX = 128;
const ISO_INSTANT_MAX = 40;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const idSchema = z.string().min(1, CODES.idInvalid).max(ID_MAX, CODES.idInvalid);

export const optionalIdSchema = idSchema.optional();

/** An instant as ISO-8601 text; the use case parses it for real. */
export const instantSchema = z
  .string()
  .min(1, CODES.dateInvalid)
  .max(ISO_INSTANT_MAX, CODES.dateInvalid);

/** A calendar day, `YYYY-MM-DD`. */
export const localDateSchema = z.string().regex(ISO_DATE_PATTERN, CODES.dateInvalid);

export const participantsSchema = z
  .number()
  .int(CODES.participantsInvalid)
  .min(1, CODES.participantsInvalid)
  .max(SERVICE_LIMITS.participantsMax, CODES.participantsInvalid);

export const referenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(BOOKING_REFERENCE_LENGTH, CODES.referenceInvalid);

export const emailSchema = z
  .string()
  .trim()
  .min(1, CODES.emailRequired)
  .max(CUSTOMER_LIMITS.emailMax, CODES.emailInvalid);

/** The booking form's values by field name; only the closed list of fields is accepted. */
export const customerValuesSchema = z.partialRecord(
  z.enum(INFORMATION_FIELDS),
  z.string().max(CUSTOMER_LIMITS.notesMax, CODES.textTooLong),
);
