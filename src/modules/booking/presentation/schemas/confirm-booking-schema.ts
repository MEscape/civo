import { z } from 'zod';

import { customerValuesSchema, idSchema } from './booking-fields-schema';

export const confirmBookingSchema = z.object({
  websiteId: idSchema,
  holdId: idSchema,
  customer: customerValuesSchema,
});

export type ConfirmBookingRequest = z.infer<typeof confirmBookingSchema>;
