import { z } from 'zod';

import { availabilityPlanSchema } from './availability-plan-schema';
import { idSchema } from './booking-fields-schema';

/** The hours employees may work at one location; `null` lifts the narrowing. */
export const staffHoursSchema = z.object({
  websiteId: idSchema,
  locationId: idSchema,
  staffHours: availabilityPlanSchema.nullable(),
});
