import { z } from 'zod';

import {
  AVAILABILITY_LIMITS,
  BOOKING_VALIDATION_CODES as CODES,
  WEEKDAYS,
} from '../../application/contracts/booking-constraints';

const TIME_TEXT_MAX = 5;
const KIND_MAX = 20;
const DATE_TEXT_MAX = 10;

const timeRangeSchema = z.object({
  start: z.string().max(TIME_TEXT_MAX, CODES.timeRangeInvalid),
  end: z.string().max(TIME_TEXT_MAX, CODES.timeRangeInvalid),
});

const dayScheduleSchema = z.object({
  intervals: z.array(timeRangeSchema).max(AVAILABILITY_LIMITS.maxRangesPerDay, CODES.tooMany),
  breaks: z.array(timeRangeSchema).max(AVAILABILITY_LIMITS.maxBreaksPerDay, CODES.tooMany),
});

const exceptionSchema = z.object({
  kind: z.string().max(KIND_MAX, CODES.exceptionKindUnknown),
  from: z.string().max(DATE_TEXT_MAX, CODES.dateInvalid),
  to: z.string().max(DATE_TEXT_MAX, CODES.dateInvalid),
  day: dayScheduleSchema.optional(),
  label: z
    .string()
    .max(AVAILABILITY_LIMITS.maxLabelLength, CODES.textTooLong)
    .nullable()
    .optional(),
});

/** When something can be booked: seven weekdays (Monday first) with breaks, plus dated exceptions. */
export const availabilityPlanSchema = z.object({
  weekly: z.array(dayScheduleSchema).length(WEEKDAYS.length, CODES.timeRangeInvalid),
  exceptions: z.array(exceptionSchema).max(AVAILABILITY_LIMITS.maxExceptions, CODES.tooMany),
});

export type AvailabilityPlanForm = z.infer<typeof availabilityPlanSchema>;
