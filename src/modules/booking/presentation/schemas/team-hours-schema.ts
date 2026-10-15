import { z } from 'zod';

import { MAX_TEAM_HOURS_BATCH } from '../../application/contracts/booking-constraints';

import { availabilityPlanSchema } from './availability-plan-schema';
import { idSchema } from './booking-fields-schema';

/** Working hours for one employee or for several: `availability: null` means "the location's own hours". */
export const teamHoursSchema = z.object({
  websiteId: idSchema,
  resourceIds: z.array(idSchema).min(1).max(MAX_TEAM_HOURS_BATCH),
  availability: availabilityPlanSchema.nullable(),
});
