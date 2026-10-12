import { z } from 'zod';

import { availabilityPlanSchema } from './availability-plan-schema';
import { idSchema } from './booking-fields-schema';

/** An employee's new working hours for one calendar; the use case checks the calendar is theirs. */
export const ownAvailabilitySchema = z.object({
  resourceId: idSchema,
  availability: availabilityPlanSchema,
});

export type OwnAvailability = z.infer<typeof ownAvailabilitySchema>;
