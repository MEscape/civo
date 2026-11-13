import { z } from 'zod';

import { pageParamsSchema } from '@lib/pagination';

/** Pagination remains bounded by each query; malformed tab values select the history. */
export const releaseListParamsSchema = pageParamsSchema.extend({
  tab: z.enum(['releases', 'updates']).catch('releases'),
});

export type ReleaseListParams = z.infer<typeof releaseListParamsSchema>;
