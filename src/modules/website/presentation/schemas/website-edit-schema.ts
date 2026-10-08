import { z } from 'zod';

import {
  websiteDescriptionSchema,
  websiteIdSchema,
  websiteNameSchema,
} from './website-fields-schema';

/** `description: null` clears the description; omitting it leaves it alone. */
export const websiteEditSchema = z.object({
  id: websiteIdSchema,
  name: websiteNameSchema.optional(),
  description: websiteDescriptionSchema.nullable().optional(),
});

export type WebsiteEdit = z.infer<typeof websiteEditSchema>;
