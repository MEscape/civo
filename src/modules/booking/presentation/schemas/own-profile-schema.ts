import { z } from 'zod';

import {
  BOOKING_VALIDATION_CODES as CODES,
  RESOURCE_LIMITS,
} from '../../application/contracts/booking-constraints';

import { availabilityPlanSchema } from './availability-plan-schema';
import { idSchema } from './booking-fields-schema';

/** An employee's own calendar: the name it carries, where, what is offered, and when. */
export const ownProfileSchema = z.object({
  websiteId: idSchema,
  name: z
    .string()
    .trim()
    .min(1, CODES.nameRequired)
    .max(RESOURCE_LIMITS.nameMax, CODES.textTooLong),
  locationId: idSchema,
  offeredServiceIds: z.array(idSchema).max(RESOURCE_LIMITS.skillsMax, CODES.tooMany),
  availability: availabilityPlanSchema.nullable(),
});

export type OwnProfile = z.infer<typeof ownProfileSchema>;
