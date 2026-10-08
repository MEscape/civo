import { z } from 'zod';

import { websiteIdSchema } from './release-fields-schema';

export const proposeMigrationSchema = z.object({
  websiteId: websiteIdSchema,
});

export type ProposeMigration = z.infer<typeof proposeMigrationSchema>;
