import { z } from 'zod';

import {
  BOOKING_VALIDATION_CODES as CODES,
  RESOURCE_LIMITS,
} from '../../application/contracts/booking-constraints';

import { availabilityPlanSchema } from './availability-plan-schema';
import { idSchema } from './booking-fields-schema';

const TYPE_MAX = 40;

export const resourceConfigSchema = z.object({
  websiteId: idSchema,
  id: idSchema.optional(),
  locationId: idSchema.nullable(),
  name: z
    .string()
    .trim()
    .min(1, CODES.nameRequired)
    .max(RESOURCE_LIMITS.nameMax, CODES.textTooLong),
  type: z.string().max(TYPE_MAX, CODES.resourceTypeUnknown),
  skills: z
    .array(z.string().max(RESOURCE_LIMITS.skillMax, CODES.skillInvalid))
    .max(RESOURCE_LIMITS.skillsMax, CODES.tooMany),
  capacity: z
    .number()
    .int(CODES.capacityInvalid)
    .min(1, CODES.capacityInvalid)
    .max(RESOURCE_LIMITS.capacityMax, CODES.capacityInvalid)
    .nullable(),
  availability: availabilityPlanSchema.nullable(),
  isActive: z.boolean(),
});

export type ResourceConfig = z.infer<typeof resourceConfigSchema>;
