import { z } from 'zod';

import { migrationIdSchema, resolutionSchema, websiteIdSchema } from './release-fields-schema';

/**
 * Resolutions are keyed page path -> node id -> field key. The migration is
 * addressed through its website, so authorization always covers the site
 * that changes.
 */
export const applyMigrationSchema = z.object({
  websiteId: websiteIdSchema,
  migrationId: migrationIdSchema,
  resolutions: z.record(z.string(), z.record(z.string(), z.record(z.string(), resolutionSchema))),
});

export type ApplyMigration = z.infer<typeof applyMigrationSchema>;
