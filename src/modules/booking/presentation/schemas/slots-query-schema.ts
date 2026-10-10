import { z } from 'zod';

import { idSchema, localDateSchema, participantsSchema } from './booking-fields-schema';

export const slotsQuerySchema = z.object({
  websiteId: idSchema,
  serviceId: idSchema,
  locationId: idSchema,
  from: localDateSchema,
  to: localDateSchema,
  participants: participantsSchema,
});

export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
