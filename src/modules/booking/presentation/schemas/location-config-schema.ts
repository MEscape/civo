import { z } from 'zod';

import {
  BOOKING_VALIDATION_CODES as CODES,
  LOCATION_LIMITS,
} from '../../application/contracts/booking-constraints';

import { availabilityPlanSchema } from './availability-plan-schema';
import { idSchema } from './booking-fields-schema';

const TIME_ZONE_MAX = 64;

/** What the location form submits; `id` is present when an existing location is edited. */
export const locationConfigSchema = z.object({
  websiteId: idSchema,
  id: idSchema.optional(),
  name: z
    .string()
    .trim()
    .min(1, CODES.nameRequired)
    .max(LOCATION_LIMITS.nameMax, CODES.textTooLong),
  address: z.string().max(LOCATION_LIMITS.addressMax, CODES.textTooLong).nullable(),
  timeZone: z.string().max(TIME_ZONE_MAX, CODES.timeZoneInvalid),
  openingHours: availabilityPlanSchema,
  isActive: z.boolean(),
});

export type LocationConfig = z.infer<typeof locationConfigSchema>;
