import { z } from 'zod';

import { canonicalKindSchema, idSchema } from './data-source-fields-schema';

export const listCompatibleSchema = z.object({
  websiteId: idSchema,
  canonicalKind: canonicalKindSchema,
});
