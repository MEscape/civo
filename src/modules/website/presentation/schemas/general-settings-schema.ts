import { z } from 'zod';

import { websiteDescriptionSchema, websiteNameSchema } from './website-fields-schema';

/**
 * The editable general fields of a website. The slug is a public URL and
 * stays immutable, so it is not a form value. An empty description is valid:
 * it clears the stored one.
 */
export const generalSettingsSchema = z.object({
  name: websiteNameSchema,
  description: websiteDescriptionSchema,
});

export type GeneralSettings = z.infer<typeof generalSettingsSchema>;
