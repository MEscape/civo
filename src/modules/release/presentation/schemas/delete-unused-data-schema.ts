import { z } from 'zod';

import { releaseIdSchema } from './release-fields-schema';

/** A dataset or a source, by id; the data module resolves and authorizes it. */
export const deleteUnusedDataSchema = z.object({
  kind: z.enum(['dataset', 'source']),
  // Same shape as every id this module accepts; the data module re-validates its own.
  id: releaseIdSchema,
});
