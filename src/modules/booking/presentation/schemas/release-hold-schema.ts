import { z } from 'zod';

import { idSchema } from './booking-fields-schema';

export const releaseHoldSchema = z.object({
  websiteId: idSchema,
  holdId: idSchema,
});
