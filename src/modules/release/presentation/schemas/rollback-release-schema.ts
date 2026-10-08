import { z } from 'zod';

import { releaseIdSchema, websiteIdSchema } from './release-fields-schema';

/** The release is addressed through its website, so authorization always covers the site that changes. */
export const rollbackReleaseSchema = z.object({
  websiteId: websiteIdSchema,
  releaseId: releaseIdSchema,
});

export type RollbackRelease = z.infer<typeof rollbackReleaseSchema>;
