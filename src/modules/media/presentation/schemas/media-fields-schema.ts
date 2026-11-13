import { z } from 'zod';

import { MEDIA_VALIDATION_CODES as CODES } from '../../application/contracts/media-constraints';

/**
 * Field schemas shared by the media actions. Messages are stable codes, never prose: the UI
 * translates them (i18n.md). They only bound the SHAPE of what arrives; the domain and auth check
 * the real shape (a UUID) before an id is used.
 */
const ID_INPUT_MAX = 64;

export const websiteIdSchema = z
  .string()
  .min(1, { message: CODES.websiteInvalid })
  .max(ID_INPUT_MAX, { message: CODES.websiteInvalid });

export const mediaIdSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(ID_INPUT_MAX, { message: CODES.idInvalid });
