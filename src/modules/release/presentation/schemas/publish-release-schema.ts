import { z } from 'zod';

import { websiteIdSchema } from './release-fields-schema';

export const publishReleaseSchema = z.object({
  websiteId: websiteIdSchema,
});

export type PublishRelease = z.infer<typeof publishReleaseSchema>;
