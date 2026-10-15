import { z } from 'zod';

import { RESOURCE_LIMITS } from '../../application/contracts/booking-constraints';

import { idSchema } from './booking-fields-schema';

/** The services one employee offers, as a manager sets them. */
export const teamServicesSchema = z.object({
  websiteId: idSchema,
  resourceId: idSchema,
  offeredServiceIds: z.array(idSchema).max(RESOURCE_LIMITS.skillsMax),
});
