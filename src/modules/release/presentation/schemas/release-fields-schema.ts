import { z } from 'zod';

import {
  MIGRATION_ID_MAX_LENGTH,
  RELEASE_ID_MAX_LENGTH,
  RELEASE_VALIDATION_CODES as CODES,
  RESOLUTION_ACTIONS,
  WEBSITE_ID_MAX_LENGTH,
} from '../../application/contracts/release-constraints';

/**
 * Field schemas shared by the release actions. Messages are stable codes,
 * never prose: the UI translates them (i18n.md). Limits come from the
 * domain constants, so a number is defined exactly once.
 */
export const releaseIdSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(RELEASE_ID_MAX_LENGTH, { message: CODES.idInvalid });

export const websiteIdSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(WEBSITE_ID_MAX_LENGTH, { message: CODES.idInvalid });

export const migrationIdSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(MIGRATION_ID_MAX_LENGTH, { message: CODES.idInvalid });

/**
 * Only the shape is checked here. Whether the named page, node and field
 * exist in the stored plan, and whether a custom value is acceptable JSON,
 * is the domain's job (`parseConflictResolutions`): it needs the plan.
 */
export const resolutionSchema = z.object({
  action: z.enum(RESOLUTION_ACTIONS, {
    message: CODES.resolutionActionInvalid,
  }),
  value: z.unknown().optional(),
});
