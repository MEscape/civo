import { z } from 'zod';

import { pageParamsSchema } from '@lib/pagination';

import { MEDIA_VISIBILITIES } from '../../application/contracts/media-constraints';

/** Long enough for any file name the domain keeps; longer text cannot match anything. */
const SEARCH_MAX = 120;

/**
 * The library's address: page, search, visibility and sort. Repeated or malformed values fall back
 * to "no filter" and the query's defaults; the sort is checked against an allowlist by the loader.
 */
export const mediaListParamsSchema = pageParamsSchema.extend({
  q: z.string().trim().max(SEARCH_MAX).optional().catch(undefined),
  visibility: z.enum(MEDIA_VISIBILITIES).optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
});
