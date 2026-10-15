import { z } from 'zod';

import { idSchema } from './booking-fields-schema';

/** Offer an existing service at a location, or stop offering it there. */
export const offerServiceSchema = z.object({
  websiteId: idSchema,
  serviceId: idSchema,
  locationId: idSchema,
  isOffered: z.boolean(),
});
