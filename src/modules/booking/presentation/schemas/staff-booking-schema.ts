import { z } from 'zod';

import {
  BOOKING_INPUT_LIMITS as LIMITS,
  BOOKING_VALIDATION_CODES as CODES,
} from '../../application/contracts/booking-constraints';

import {
  customerSchema,
  daySchema,
  idSchema,
  instantSchema,
  requirementIndexSchema,
} from './booking-fields-schema';

/**
 * What the actions of managers and employees accept. Each names the website it is for, which the
 * use case authorizes in auth; none names a tenant or a person: those come from the signed-in session.
 */
export const bookingTargetSchema = z.object({ websiteId: idSchema, bookingId: idSchema });

export const createBookingAsStaffSchema = z.object({
  websiteId: idSchema,
  serviceId: idSchema,
  locationId: idSchema,
  start: instantSchema,
  customer: customerSchema,
  requestKey: z
    .string()
    .min(1, { message: CODES.idInvalid })
    .max(LIMITS.requestKeyMax, { message: CODES.idInvalid })
    .optional(),
});

export const rescheduleBookingSchema = bookingTargetSchema.extend({ start: instantSchema });

export const assignEmployeeSchema = bookingTargetSchema.extend({
  resourceId: idSchema,
  requirementIndex: requirementIndexSchema.optional(),
  replaces: idSchema.optional(),
});

export const unassignEmployeeSchema = bookingTargetSchema.extend({ resourceId: idSchema });

export const assignmentCandidatesSchema = bookingTargetSchema.extend({
  requirementIndex: requirementIndexSchema.optional(),
});

/** One day's free starts for a manager: of a booking being moved, or of a service at a location. */
export const staffSlotsSchema = z.object({
  websiteId: idSchema,
  day: daySchema,
  bookingId: idSchema.optional(),
  serviceId: idSchema.optional(),
  locationId: idSchema.optional(),
});
