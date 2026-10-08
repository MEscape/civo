import { z } from 'zod';

import { idSchema, pagePathSchema, pageTitleSchema } from './page-fields-schema';

export const newPageSchema = z.object({
  websiteId: idSchema,
  path: pagePathSchema,
  title: pageTitleSchema,
});

export type NewPage = z.infer<typeof newPageSchema>;
