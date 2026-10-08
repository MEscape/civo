import { z } from 'zod';

import { pageConfigSchema } from './page-config-schema';
import { idSchema, pageVersionSchema } from './page-fields-schema';

/** The website is never part of the input: the use case reads it from the stored page. */
export const savePageConfigSchema = z.object({
  pageId: idSchema,
  expectedVersion: pageVersionSchema,
  config: pageConfigSchema,
});
