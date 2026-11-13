import { z } from 'zod';

import {
  BOOKING_ID_MAX_LENGTH,
  BOOKING_VALIDATION_CODES as CODES,
  LOCATION_LIMITS,
  SERVICE_LIMITS as LIMITS,
  parseServiceInput,
} from '../../application/contracts/booking-constraints';

import { idSchema } from './booking-fields-schema';

import type { ServiceInput } from '../../application/contracts/service-inputs';

/** The longest word of a closed vocabulary a request may name (`block-new`, `qualified`). */
const SHORT_CODE_MAX = 16;

/** A size limit that stops the check: text that is too long is not read by the rules as well. */
const tooBig = (code: string) => ({ message: code, abort: true }) as const;

/** A whole number the form sends; anything else is refused at the field with that field's own code. */
const numberOf = (code: string) => z.number({ message: code });

const actorSchema = z.string().max(LIMITS.qualificationMax, tooBig(CODES.actorsRequired));

const resourceSchema = z.object({
  resourceId: z.string().max(BOOKING_ID_MAX_LENGTH, tooBig(CODES.resourceInvalid)),
  isRequired: z.boolean({ message: CODES.resourceInvalid }),
});

/**
 * What the service actions accept. The shape and the size of untrusted text are checked here; what
 * the numbers MEAN (a notice shorter than the horizon, a deadline that is not negative, someone who
 * may cancel, a qualification when one is asked for) is checked by the very function the use case
 * runs, so the form shows the same message at the same field the server would refuse with. None of
 * it names a website, a tenant or a person.
 */
const serviceShapeSchema = z.object({
  name: z.string().max(LIMITS.nameMax, tooBig(CODES.nameInvalid)),
  description: z.string().max(LIMITS.descriptionMax, tooBig(CODES.descriptionInvalid)),
  category: z.string().max(LIMITS.categoryMax, tooBig(CODES.categoryInvalid)),
  documents: z
    .array(z.string().max(LIMITS.documentMax, tooBig(CODES.documentsInvalid)))
    .max(LIMITS.documentsMax, tooBig(CODES.documentsInvalid)),
  instructions: z.string().max(LIMITS.instructionsMax, tooBig(CODES.instructionsInvalid)),
  internalNote: z.string().max(LIMITS.noteMax, tooBig(CODES.noteInvalid)),
  isOnlineBookable: z.boolean({ message: CODES.limitInvalid }),
  isActive: z.boolean({ message: CODES.limitInvalid }),
  durationMinutes: numberOf(CODES.durationInvalid),
  preparationMinutes: numberOf(CODES.bufferInvalid),
  cleanupMinutes: numberOf(CODES.bufferInvalid),
  resources: z.array(resourceSchema).max(LIMITS.resourcesMax, tooBig(CODES.resourceInvalid)),
  noticeMinutes: numberOf(CODES.noticeInvalid),
  horizonDays: numberOf(CODES.horizonInvalid),
  cancelUntilMinutes: numberOf(CODES.deadlineInvalid),
  changeUntilMinutes: numberOf(CODES.deadlineInvalid),
  actors: z.array(actorSchema).max(LIMITS.resourcesMax, tooBig(CODES.actorsRequired)),
  employee: z.string().max(LIMITS.qualificationMax, tooBig(CODES.qualificationInvalid)),
  qualification: z.string().max(LIMITS.qualificationMax, tooBig(CODES.qualificationInvalid)),
});

/** A dotted path from the rules, as the path array the resolver wants: `resources.0.resourceId` is `['resources', 0, 'resourceId']`. */
const pathOf = (dotted: string) =>
  dotted.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part));

/** The refusals of the rules as issues at their fields. */
function addRuleIssues(value: ServiceInput, context: z.RefinementCtx): void {
  const result = parseServiceInput(value);
  if (result.isErr()) {
    for (const [path, codes] of Object.entries(result.error.fieldErrors)) {
      for (const code of codes) {
        context.addIssue({ code: 'custom', path: pathOf(path), message: code });
      }
    }
  }
}

export const serviceInputSchema = serviceShapeSchema.superRefine(addRuleIssues);

/** The values of the service form: what the schema reads, which is what the use case is sent. */
export type ServiceFormValues = z.infer<typeof serviceInputSchema>;

const versionSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(LOCATION_LIMITS.versionMax, { message: CODES.idInvalid });

export const createServiceSchema = serviceShapeSchema
  .extend({ websiteId: idSchema, locationId: idSchema })
  .superRefine(addRuleIssues);

export const updateServiceSchema = serviceShapeSchema
  .extend({
    websiteId: idSchema,
    locationId: idSchema,
    serviceId: idSchema,
    expectedVersion: versionSchema,
    expectedSettingVersion: versionSchema,
    acknowledgeShared: z.boolean({ message: CODES.limitInvalid }),
  })
  .superRefine(addRuleIssues);

export const adoptServiceSchema = z.object({
  websiteId: idSchema,
  locationId: idSchema,
  serviceId: idSchema,
  sourceLocationId: idSchema,
  mode: z.string().max(SHORT_CODE_MAX, { message: CODES.adoptModeInvalid }),
});

export const previewServiceDeactivationSchema = z.object({
  websiteId: idSchema,
  locationId: idSchema,
  serviceId: idSchema,
  scope: z.string().max(SHORT_CODE_MAX, { message: CODES.idInvalid }),
});

/** The most bookings one closing can carry a decision for (`MAX_IMPACT_BOOKINGS`). */
const MAX_RESOLUTIONS = 500;

export const deactivateServiceSchema = previewServiceDeactivationSchema.extend({
  mode: z.string().max(SHORT_CODE_MAX, { message: CODES.idInvalid }),
  resolutions: z
    .array(
      z.object({
        bookingId: idSchema,
        kind: z.string().max(SHORT_CODE_MAX, { message: CODES.idInvalid }),
      }),
    )
    .max(MAX_RESOLUTIONS, { message: CODES.tooMany }),
  expectedVersion: versionSchema,
  expectedSettingVersion: versionSchema,
});

export const reactivateServiceSchema = previewServiceDeactivationSchema.extend({
  expectedVersion: versionSchema,
  expectedSettingVersion: versionSchema,
});
