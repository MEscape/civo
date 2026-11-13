import { z } from 'zod';

import {
  BOOKING_INPUT_LIMITS as LIMITS,
  BOOKING_VALIDATION_CODES as CODES,
} from '../../application/contracts/booking-constraints';

import type { JourneyDetails } from './journey-state';
import type { InformationField } from '../../application/contracts/booking-constraints';
import type { CatalogServiceDto } from '../dto/catalog-dto';

const MAX_LENGTH: Readonly<Record<InformationField, number>> = {
  firstName: LIMITS.nameMax,
  lastName: LIMITS.nameMax,
  email: LIMITS.emailMax,
  phone: LIMITS.phoneMax,
  referenceNumber: LIMITS.referenceNumberMax,
  notes: LIMITS.notesMax,
};

function fieldSchema(field: InformationField, isRequired: boolean) {
  const text = z.string().trim().max(MAX_LENGTH[field], { message: CODES.fieldRequired });
  const checked =
    field === 'email'
      ? text.refine((value) => value === '' || z.email().safeParse(value).success, {
          message: CODES.emailInvalid,
        })
      : text;
  return isRequired
    ? checked.refine((value) => value !== '', { message: CODES.fieldRequired })
    : checked;
}

/**
 * The booking form of one service: the fields it asks for, the required ones required, with the
 * server's codes as messages. A help to the visitor only: the server checks again on confirming.
 */
export function detailsSchemaOf(service: CatalogServiceDto) {
  return z.object(
    Object.fromEntries(
      service.information.map(({ field, isRequired }) => [field, fieldSchema(field, isRequired)]),
    ),
  );
}

/** The fields the service asks for, as the visitor typed them (empty when not yet): the form's values and the customer sent. */
export function detailsValuesOf(service: CatalogServiceDto, details: JourneyDetails) {
  return Object.fromEntries(
    service.information.map(({ field }) => [field, details[field] ?? '']),
  ) as Record<string, string>;
}
