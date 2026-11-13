import { z } from 'zod';

import {
  BOOKING_VALIDATION_CODES as CODES,
  LOCATION_LIMITS,
  SERVICE_LIMITS,
  MAX_COVERAGE_SPELLS,
  parseEmployeeCalendar,
} from '../../application/contracts/booking-constraints';

import { idSchema } from './booking-fields-schema';
import { openingHoursSchema, pathOf } from './location-schema';

import type { EmployeeCalendarInput } from '../../application/contracts/team-inputs';

/** The most qualifications a request may carry; the rules hold the real limit. */
const QUALIFICATIONS_MAX = 50;
/** `YYYY-MM-DD`, with room for what a person may type before the rules read it. */
const DATE_MAX = 32;

/** The refusals of the rules as issues at their fields: the message the server would refuse with. */
function addRuleIssues(value: EmployeeCalendarInput, context: z.RefinementCtx): void {
  const result = parseEmployeeCalendar(value);
  if (result.isErr()) {
    for (const [path, codes] of Object.entries(result.error.fieldErrors)) {
      for (const code of codes) {
        context.addIssue({ code: 'custom', path: pathOf(path), message: code });
      }
    }
  }
}

const versionSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(LOCATION_LIMITS.versionMax, { message: CODES.idInvalid });
const acknowledgeSchema = z.boolean({ message: CODES.limitInvalid });
const qualificationsSchema = z
  .array(z.string().max(SERVICE_LIMITS.qualificationMax, { message: CODES.qualificationInvalid }))
  .max(QUALIFICATIONS_MAX, { message: CODES.qualificationInvalid });

const calendarShape = z.object({ openingHours: openingHoursSchema });

/** One spell of cover as the form and the request carry it; the rules hold what it means. */
const coverageSchema = z
  .array(
    z.object({
      locationId: idSchema,
      from: z.string().max(DATE_MAX),
      to: z.string().max(DATE_MAX),
    }),
  )
  .max(MAX_COVERAGE_SPELLS, { message: CODES.tooMany });

/**
 * What the team actions accept. Shape and size are checked here; what the hours and absences mean is
 * checked by the very function the use case runs. Whether the week fits the location is only known
 * to the server, which answers at the day. The actions name the website; the employee's own requests
 * name no calendar.
 */
export const teamMemberFormSchema = calendarShape
  .extend({ qualifications: qualificationsSchema, coverage: coverageSchema })
  .superRefine(addRuleIssues);
export type TeamMemberFormValues = z.infer<typeof teamMemberFormSchema>;

export const updateTeamMemberSchema = calendarShape
  .extend({
    websiteId: idSchema,
    employeeId: idSchema,
    expectedVersion: versionSchema,
    qualifications: qualificationsSchema,
    coverage: coverageSchema,
    acknowledgeImpact: acknowledgeSchema,
  })
  .superRefine(addRuleIssues);

export const removeTeamMemberSchema = z.object({
  websiteId: idSchema,
  employeeId: idSchema,
  expectedVersion: versionSchema,
  acknowledgeImpact: acknowledgeSchema,
});

export const moveTeamMemberSchema = removeTeamMemberSchema.extend({ locationId: idSchema });

export const previewTeamMemberRemovalSchema = z.object({
  websiteId: idSchema,
  employeeId: idSchema,
});

export const saveOwnProfileSchema = calendarShape
  .extend({
    websiteId: idSchema,
    expectedVersion: versionSchema,
    acknowledgeImpact: acknowledgeSchema,
  })
  .superRefine(addRuleIssues);

export const previewTeamMemberChangeSchema = z.object({
  websiteId: idSchema,
  employeeId: idSchema,
  calendar: calendarShape.superRefine(addRuleIssues),
  coverage: coverageSchema.optional(),
});

export const previewOwnProfileChangeSchema = z.object({
  websiteId: idSchema,
  calendar: calendarShape.superRefine(addRuleIssues),
});

export const setUpTeamMemberSchema = z.object({
  websiteId: idSchema,
  actorId: idSchema,
  locationId: idSchema,
});
