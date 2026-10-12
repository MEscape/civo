import { z } from 'zod';

import {
  LIST_LIMITS,
  MAX_LIST_OFFSET,
  PROP_LIMITS,
} from '../../application/contracts/component-platform-constraints';

/**
 * A visitor moving a chart: which dataset of which website, which part of it.
 * Everything is untrusted; the use case scopes the dataset to the website and
 * bounds the window again.
 */
export const readTrendWindowSchema = z.object({
  websiteId: z.string().min(1).max(PROP_LIMITS.id),
  datasetId: z.string().min(1).max(PROP_LIMITS.id),
  series: z.string().max(PROP_LIMITS.label).nullable(),
  category: z.string().max(PROP_LIMITS.category).optional(),
  limit: z.number().int().min(LIST_LIMITS.dataset.min).max(LIST_LIMITS.dataset.max),
  offset: z.number().int().min(0).max(MAX_LIST_OFFSET),
});

export type ReadTrendWindow = z.infer<typeof readTrendWindowSchema>;
