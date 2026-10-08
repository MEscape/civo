import { z } from 'zod';

import {
  SLUG_PATTERN,
  WEBSITE_ID_MAX_LENGTH,
  WEBSITE_LIMITS,
  WEBSITE_VALIDATION_CODES as CODES,
} from '../../application/contracts/website-constraints';

/**
 * Field schemas shared by the create and edit forms. Messages are stable
 * codes, never prose: the UI translates them (i18n.md). Limits come from
 * the domain constants, so a number is defined exactly once.
 */
export const websiteIdSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(WEBSITE_ID_MAX_LENGTH, { message: CODES.idInvalid });

export const websiteNameSchema = z
  .string()
  .trim()
  .min(WEBSITE_LIMITS.nameMin, { message: CODES.nameTooShort })
  .max(WEBSITE_LIMITS.nameMax, { message: CODES.nameTooLong });

export const websiteSlugSchema = z
  .string()
  .trim()
  .min(1, { message: CODES.slugRequired })
  .max(WEBSITE_LIMITS.slugMax, { message: CODES.slugTooLong })
  .regex(SLUG_PATTERN, { message: CODES.slugInvalid });

export const websiteDescriptionSchema = z
  .string()
  .trim()
  .max(WEBSITE_LIMITS.descriptionMax, { message: CODES.descriptionTooLong });
