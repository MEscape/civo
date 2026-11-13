import { z } from 'zod';

import { mediaIdSchema, websiteIdSchema } from './media-fields-schema';

/** One file of one website, as the browser names it. The use case authorizes both. */
export const mediaTargetSchema = z.object({
  websiteId: websiteIdSchema,
  id: mediaIdSchema,
});
