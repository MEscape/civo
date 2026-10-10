import { z } from 'zod';

import {
  BOOKING_VALIDATION_CODES as CODES,
  SERVICE_LIMITS,
} from '../../application/contracts/booking-constraints';

import { availabilityPlanSchema } from './availability-plan-schema';
import { idSchema } from './booking-fields-schema';

const TYPE_MAX = 40;
const FIELD_MAX = 40;
const ACTOR_MAX = 20;

const integer = (code: string) => z.number().int(code);

const requirementSchema = z.object({
  resourceType: z.string().max(TYPE_MAX, CODES.resourceTypeUnknown),
  skills: z
    .array(z.string().max(SERVICE_LIMITS.categoryMax, CODES.skillInvalid))
    .max(SERVICE_LIMITS.skillsPerRequirementMax, CODES.tooMany),
  count: integer(CODES.requirementCountInvalid),
  resourceIds: z.array(idSchema).max(SERVICE_LIMITS.poolMax, CODES.tooMany).nullable(),
});

const changePolicySchema = z.object({
  isAllowed: z.boolean(),
  deadlineMinutes: integer(CODES.changePolicyInvalid),
  allowedActors: z.array(z.string().max(ACTOR_MAX, CODES.actorUnknown)).max(2, CODES.tooMany),
});

/** What the service form submits; `id` is present when an existing service is edited. */
export const serviceConfigSchema = z.object({
  websiteId: idSchema,
  id: idSchema.optional(),
  name: z.string().trim().min(1, CODES.nameRequired).max(SERVICE_LIMITS.nameMax, CODES.textTooLong),
  description: z.string().max(SERVICE_LIMITS.descriptionMax, CODES.textTooLong).nullable(),
  category: z.string().max(SERVICE_LIMITS.categoryMax, CODES.categoryInvalid).nullable(),
  isActive: z.boolean(),
  durationMinutes: integer(CODES.durationInvalid),
  preparationMinutes: integer(CODES.bufferInvalid),
  cleanupMinutes: integer(CODES.bufferInvalid),
  slotIntervalMinutes: integer(CODES.slotIntervalInvalid),
  locationIds: z.array(idSchema).max(SERVICE_LIMITS.locationsMax, CODES.tooMany),
  requirements: z.array(requirementSchema).max(SERVICE_LIMITS.requirementsMax, CODES.tooMany),
  participantsPerBooking: integer(CODES.participantsInvalid),
  participantsPerSession: integer(CODES.participantsInvalid),
  noticeMinutes: integer(CODES.noticeInvalid),
  horizonDays: integer(CODES.horizonInvalid),
  availability: availabilityPlanSchema.nullable(),
  cancellation: changePolicySchema,
  rescheduling: changePolicySchema,
  information: z
    .array(
      z.object({
        field: z.string().max(FIELD_MAX, CODES.informationFieldUnknown),
        isRequired: z.boolean(),
      }),
    )
    .max(SERVICE_LIMITS.documentsMax, CODES.tooMany),
  requiredDocuments: z
    .array(z.string().max(SERVICE_LIMITS.documentMax, CODES.textTooLong))
    .max(SERVICE_LIMITS.documentsMax, CODES.tooMany),
  instructions: z.string().max(SERVICE_LIMITS.instructionsMax, CODES.textTooLong).nullable(),
});

export type ServiceConfig = z.infer<typeof serviceConfigSchema>;
