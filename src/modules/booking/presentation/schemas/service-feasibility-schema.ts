import { idSchema } from './booking-fields-schema';
import { serviceConfigSchema } from './service-config-schema';

import type { z } from 'zod';

/** The part of the service form the feasibility preview needs; the rest may still be incomplete. */
export const serviceFeasibilitySchema = serviceConfigSchema
  .pick({
    websiteId: true,
    locationIds: true,
    requirements: true,
    participantsPerBooking: true,
    participantsPerSession: true,
  })
  .extend({ serviceId: idSchema.optional() });

export type ServiceFeasibilityQuery = z.infer<typeof serviceFeasibilitySchema>;
