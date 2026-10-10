import { z } from 'zod';

import {
  idSchema,
  instantSchema,
  localDateSchema,
  optionalIdSchema,
} from './booking-fields-schema';

export const operationsCalendarSchema = z.object({
  websiteId: idSchema,
  from: localDateSchema,
  to: localDateSchema,
  locationId: optionalIdSchema,
  serviceId: optionalIdSchema,
  resourceId: optionalIdSchema,
});

export const staffBookingSchema = z.object({
  bookingId: idSchema,
});

export const staffRescheduleSchema = staffBookingSchema.extend({
  start: instantSchema,
});
