import { z } from 'zod';

import {
  BOOKING_VALIDATION_CODES as CODES,
  EXCEPTION_KINDS,
  LOCATION_LIMITS as LIMITS,
  parseLocationInput,
} from '../../application/contracts/booking-constraints';

import { idSchema } from './booking-fields-schema';

import type { LocationInput } from '../../application/contracts/location-inputs';

/** A size limit that stops the check: text that is too long is not read by the rules as well. */
const tooBig = (code: string) => ({ message: code, abort: true }) as const;

/**
 * What the location actions accept. The shape and the size of untrusted text are checked here; what
 * the hours MEAN (a range that ends before it starts, ranges that overlap, a break outside the open
 * hours, an exception without hours) is checked by the very function the use case runs, so the form
 * shows the same message at the same field the server would refuse with. None of it names a
 * website or a person.
 */
const DAYS_PER_WEEK = 7;
const timeSchema = z.string().max(LIMITS.timeMax, tooBig(CODES.timeRangeInvalid));
const rangeSchema = z.object({ start: timeSchema, end: timeSchema });
const daySchema = z.object({
  intervals: z.array(rangeSchema).max(LIMITS.rangesPerDayMax, tooBig(CODES.tooMany)),
  breaks: z.array(rangeSchema).max(LIMITS.rangesPerDayMax, tooBig(CODES.tooMany)),
});
const dateSchema = z.string().max(LIMITS.dayMax, tooBig(CODES.exceptionInvalid));
const exceptionSchema = z.object({
  kind: z.enum(EXCEPTION_KINDS, { message: CODES.exceptionInvalid }),
  from: dateSchema,
  to: dateSchema,
  day: daySchema.optional(),
});

/** A week and its dated exceptions, as the hours editors send them: a location's hours, a resource's own. */
export const openingHoursSchema = z.object({
  weekly: z.array(daySchema).max(DAYS_PER_WEEK, tooBig(CODES.weekInvalid)),
  exceptions: z.array(exceptionSchema).max(LIMITS.exceptionsMax, tooBig(CODES.tooMany)),
});

/** A dotted path from the rules, as the path array the resolver wants: `weekly.0.end` is `['weekly', 0, 'end']`. */
export const pathOf = (dotted: string) =>
  dotted.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part));

const locationShapeSchema = z.object({
  name: z.string().max(LIMITS.nameMax, tooBig(CODES.nameInvalid)),
  address: z.string().max(LIMITS.addressMax, tooBig(CODES.addressInvalid)),
  timeZone: z.string().max(LIMITS.zoneMax, tooBig(CODES.timeZoneInvalid)),
  isActive: z.boolean({ message: CODES.limitInvalid }),
  openingHours: openingHoursSchema,
});

/** The refusals of the rules as issues at their fields. */
function addRuleIssues(value: LocationInput, context: z.RefinementCtx): void {
  const result = parseLocationInput(value);
  if (result.isErr()) {
    for (const [path, codes] of Object.entries(result.error.fieldErrors)) {
      for (const code of codes) {
        context.addIssue({ code: 'custom', path: pathOf(path), message: code });
      }
    }
  }
}

export const locationInputSchema = locationShapeSchema.superRefine(addRuleIssues);

/** The values of the location form: what the schema reads, which is what the use case is sent. */
export type LocationFormValues = z.infer<typeof locationInputSchema>;

/** Creating a location names the website it is for; the form's own values do not. */
export const createLocationSchema = locationShapeSchema
  .extend({ websiteId: idSchema })
  .superRefine(addRuleIssues);

export const updateLocationSchema = locationShapeSchema
  .extend({
    websiteId: idSchema,
    locationId: idSchema,
    expectedVersion: z
      .string()
      .min(1, { message: CODES.idInvalid })
      .max(LIMITS.versionMax, { message: CODES.idInvalid }),
    acknowledgeImpact: z.boolean({ message: CODES.limitInvalid }),
  })
  .superRefine(addRuleIssues);

export const previewLocationChangeSchema = z.object({
  websiteId: idSchema,
  locationId: idSchema,
  location: locationInputSchema,
});
