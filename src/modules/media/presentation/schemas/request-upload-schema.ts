import { z } from 'zod';

import {
  MEDIA_VALIDATION_CODES as CODES,
  MEDIA_VISIBILITIES,
} from '../../application/contracts/media-constraints';

import { websiteIdSchema } from './media-fields-schema';

/**
 * What a client may send to ask for an upload. Messages are stable codes, never prose: the UI
 * translates them (i18n.md). This only bounds the SHAPE of what arrives; the rules about what a
 * file may be live in the domain and are applied there.
 */

/** Generous on purpose: the domain shortens and cleans the name. This only bounds the payload. */
const FILE_NAME_INPUT_MAX = 1024;
const CONTENT_TYPE_INPUT_MAX = 127;

export const requestUploadSchema = z.object({
  websiteId: websiteIdSchema,
  fileName: z
    .string()
    .min(1, { message: CODES.fileNameInvalid })
    .max(FILE_NAME_INPUT_MAX, { message: CODES.fileNameInvalid }),
  contentType: z.string().max(CONTENT_TYPE_INPUT_MAX, { message: CODES.contentTypeUnsupported }),
  byteSize: z.number().int({ message: CODES.sizeInvalid }),
  visibility: z
    .enum(MEDIA_VISIBILITIES, { message: CODES.visibilityUnsupported })
    .default('public'),
});
