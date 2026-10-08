import { z } from 'zod';

import {
  CANONICAL_KINDS,
  DATASET_LIMITS,
  DATA_SOURCE_LIMITS,
  DATA_SOURCE_VALIDATION_CODES as CODES,
  DATA_SOURCE_ID_MAX_LENGTH,
} from '../../application/contracts/data-source-constraints';

/**
 * Field schemas shared by the forms and the action envelopes. Messages are
 * stable codes, never prose (the UI translates them); limits come from the
 * domain constants, so a number is defined exactly once.
 */
export const idSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(DATA_SOURCE_ID_MAX_LENGTH, { message: CODES.idInvalid });

export const dataSourceNameSchema = z
  .string()
  .trim()
  .min(DATA_SOURCE_LIMITS.nameMin, { message: CODES.nameTooShort })
  .max(DATA_SOURCE_LIMITS.nameMax, { message: CODES.nameTooLong });

export const datasetNameSchema = z
  .string()
  .trim()
  .min(DATASET_LIMITS.nameMin, { message: CODES.datasetNameTooShort })
  .max(DATASET_LIMITS.nameMax, { message: CODES.datasetNameTooLong });

export const canonicalKindSchema = z.enum(CANONICAL_KINDS, {
  message: CODES.canonicalKindUnknown,
});
