import { z } from 'zod';

import { emailSchema, idSchema, instantSchema, referenceSchema } from './booking-fields-schema';

/** A visitor proves they own a booking with its reference AND the address used for it. */
export const bookingAccessSchema = z.object({
  websiteId: idSchema,
  reference: referenceSchema,
  email: emailSchema,
});

export const rescheduleOwnBookingSchema = bookingAccessSchema.extend({
  start: instantSchema,
});

export type BookingAccessRequest = z.infer<typeof bookingAccessSchema>;
