import { z } from 'zod';

import { idSchema, instantSchema, participantsSchema } from './booking-fields-schema';

/** Reserving a slot and asking for alternatives to one take the same request. */
export const holdSlotSchema = z.object({
  websiteId: idSchema,
  serviceId: idSchema,
  locationId: idSchema,
  start: instantSchema,
  participants: participantsSchema,
});

export type HoldSlotRequest = z.infer<typeof holdSlotSchema>;
