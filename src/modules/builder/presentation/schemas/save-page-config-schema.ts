import { z } from 'zod';

import { pageConfigSchema } from './page-config-schema';
import { idSchema, pageVersionSchema } from './page-fields-schema';

/** The website is named by the request and authorized by the use case; the page must belong to it. */
export const savePageConfigSchema = z.object({
  websiteId: idSchema,
  pageId: idSchema,
  expectedVersion: pageVersionSchema,
  config: pageConfigSchema,
});
