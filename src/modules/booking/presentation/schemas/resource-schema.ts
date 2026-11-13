import { z } from 'zod';

import {
  BOOKING_VALIDATION_CODES as CODES,
  LOCATION_LIMITS,
  RESOURCE_LIMITS as LIMITS,
  parseResourceInput,
} from '../../application/contracts/booking-constraints';

import { idSchema } from './booking-fields-schema';
import { openingHoursSchema, pathOf } from './location-schema';

import type { ResourceInput } from '../../application/contracts/resource-inputs';

/** A size limit that stops the check: text that is too long is not read by the rules as well. */
const tooBig = (code: string) => ({ message: code, abort: true }) as const;
const minutesSchema = z.number({ message: CODES.bufferInvalid });

/**
 * What the resource actions accept. The shape and the size of untrusted text are checked here; what
 * the values MEAN (places, buffers, hours, blocks) is checked by the very function the use case
 * runs, so the form shows the same message at the same field the server would refuse with. None of
 * it names a website or a person.
 */
const resourceShapeSchema = z.object({
  name: z.string().max(LIMITS.nameMax, tooBig(CODES.nameInvalid)),
  capacity: z.number({ message: CODES.capacityInvalid }),
  setupMinutes: minutesSchema,
  teardownMinutes: minutesSchema,
  internalNote: z.string().max(LIMITS.noteMax, tooBig(CODES.noteInvalid)),
  followsLocation: z.boolean({ message: CODES.limitInvalid }),
  openingHours: openingHoursSchema,
});

/** The refusals of the rules as issues at their fields. */
function addRuleIssues(value: ResourceInput, context: z.RefinementCtx): void {
  const result = parseResourceInput(value);
  if (result.isErr()) {
    for (const [path, codes] of Object.entries(result.error.fieldErrors)) {
      for (const code of codes) {
        context.addIssue({ code: 'custom', path: pathOf(path), message: code });
      }
    }
  }
}

const kindSchema = z.string().max(LIMITS.nameMax, tooBig(CODES.resourceTypeInvalid));

/** The values of the resource form: the kind is chosen once, when it is made. */
export const resourceFormSchema = resourceShapeSchema
  .extend({ type: kindSchema })
  .superRefine(addRuleIssues);
export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export const createResourceSchema = resourceShapeSchema
  .extend({ websiteId: idSchema, locationId: idSchema, type: kindSchema })
  .superRefine(addRuleIssues);

export const updateResourceSchema = resourceShapeSchema
  .extend({
    websiteId: idSchema,
    resourceId: idSchema,
    expectedVersion: z
      .string()
      .min(1, { message: CODES.idInvalid })
      .max(LOCATION_LIMITS.versionMax, { message: CODES.idInvalid }),
    acknowledgeImpact: z.boolean({ message: CODES.limitInvalid }),
  })
  .superRefine(addRuleIssues);

export const previewResourceChangeSchema = z.object({
  websiteId: idSchema,
  resourceId: idSchema,
  resource: resourceShapeSchema.superRefine(addRuleIssues),
});
