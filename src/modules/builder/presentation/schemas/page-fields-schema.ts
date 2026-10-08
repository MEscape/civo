import { z } from 'zod';

import {
  BUILDER_VALIDATION_CODES as CODES,
  HOME_PAGE_PATH,
  ID_MAX_LENGTH,
  INITIAL_PAGE_VERSION,
  PAGE_LIMITS,
  PAGE_PATH_PATTERN,
} from '../../application/contracts/builder-constraints';

/**
 * Shape checks for the HTTP boundary. Messages are stable codes, never
 * prose (i18n.md); limits come from the domain constants, so a number is
 * defined exactly once. The domain re-checks every invariant.
 */
export const idSchema = z
  .string({ message: CODES.idInvalid })
  .min(1, { message: CODES.idInvalid })
  .max(ID_MAX_LENGTH, { message: CODES.idInvalid });

export const pageVersionSchema = z
  .number({ message: CODES.versionInvalid })
  .int({ message: CODES.versionInvalid })
  .min(INITIAL_PAGE_VERSION, { message: CODES.versionInvalid });

export const pageTitleSchema = z
  .string({ message: CODES.titleTooShort })
  .trim()
  .min(PAGE_LIMITS.titleMin, { message: CODES.titleTooShort })
  .max(PAGE_LIMITS.titleMax, { message: CODES.titleTooLong });

export const pagePathSchema = z
  .string({ message: CODES.pathInvalid })
  .trim()
  .max(PAGE_LIMITS.pathMax, { message: CODES.pathTooLong })
  .refine((path) => path === HOME_PAGE_PATH || PAGE_PATH_PATTERN.test(path), {
    message: CODES.pathInvalid,
  });
