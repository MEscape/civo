import { z } from 'zod';

import {
  TEMPLATE_KEYS,
  WEBSITE_VALIDATION_CODES as CODES,
} from '../../application/contracts/website-constraints';

import {
  websiteDescriptionSchema,
  websiteNameSchema,
  websiteSlugSchema,
} from './website-fields-schema';

export const newWebsiteSchema = z.object({
  name: websiteNameSchema,
  slug: websiteSlugSchema,
  description: websiteDescriptionSchema.optional(),
  templateKey: z.enum(TEMPLATE_KEYS, { message: CODES.templateUnknown }),
});

export type NewWebsite = z.infer<typeof newWebsiteSchema>;
