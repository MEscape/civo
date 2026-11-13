import { z } from 'zod';

import { pageConfigSchema } from './page-config-schema';
import { idSchema } from './page-fields-schema';

export const renderDraftPageSchema = z.object({
  websiteId: idSchema,
  pageId: idSchema,
  config: pageConfigSchema,
  isPreview: z.boolean().optional(),
});
