import { z } from 'zod';

import { releaseIdSchema } from './release-fields-schema';

/** A saved map of a website, by id; the map module resolves and authorizes both again. */
export const deleteUnusedMapSchema = z.object({
  websiteId: releaseIdSchema,
  id: releaseIdSchema,
});
