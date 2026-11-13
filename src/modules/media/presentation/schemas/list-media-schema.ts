import { z } from 'zod';

import { MEDIA_VISIBILITIES } from '../../application/contracts/media-constraints';

import { websiteIdSchema } from './media-fields-schema';

/**
 * Which page of a website's files to read. The page values are untrusted and optional; the use
 * case resolves them against its own bounds, so a junk or oversized value falls back instead of
 * failing.
 */
export const listMediaSchema = z.object({
  websiteId: websiteIdSchema,
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  visibility: z.enum(MEDIA_VISIBILITIES).optional(),
});
