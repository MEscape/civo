import { deepEqual, omit } from '@lib/utils';

import { createSlotRules } from '../../domain/scheduling/slot-rules';
import { SERVICE_LIMITS } from '../contracts/booking-constraints';

import type { ParsedSharedPart } from './parse-service-input';
import type { ChangePolicy, ServiceRequirement } from '../../domain/models/bookable-service';
import type { NewService, StoredService } from '../../domain/models/stored-service';

/** What a new service starts with where the form has no field: a grid, who is asked for, who books how. */
const NEW_SERVICE_BASE = {
  information: [
    { field: 'firstName', isRequired: true },
    { field: 'lastName', isRequired: true },
    { field: 'email', isRequired: true },
  ],
  assignmentMode: 'automatic',
  availability: null,
  participantsPerBooking: 1,
  participantsPerSession: 1,
  stepMinutes: SERVICE_LIMITS.defaultStepMinutes,
} as const;

/** What a service keeps when its shared part is rewritten from a form: what the form does not show. */
export type DefinitionBase = Pick<
  StoredService,
  | 'information'
  | 'assignmentMode'
  | 'availability'
  | 'participantsPerBooking'
  | 'participantsPerSession'
  | 'homeLocationId'
  | 'copiedFromLocationId'
  | 'isActive'
> & { readonly stepMinutes: number };

export function baseOf(service: StoredService): DefinitionBase {
  return {
    information: service.information,
    assignmentMode: service.assignmentMode,
    availability: service.availability,
    participantsPerBooking: service.participantsPerBooking,
    participantsPerSession: service.participantsPerSession,
    homeLocationId: service.homeLocationId,
    copiedFromLocationId: service.copiedFromLocationId,
    isActive: service.isActive,
    stepMinutes: service.rules.stepMinutes,
  };
}

/** The base of a service made here: `homeLocationId` is where it is made, a copy says where it came from. */
export function newBase(origin: Pick<DefinitionBase, 'homeLocationId' | 'copiedFromLocationId'>) {
  return { ...NEW_SERVICE_BASE, isActive: true, ...origin } satisfies DefinitionBase;
}

/** The employee as a requirement: nobody, anyone, or someone who holds the qualification. */
function employeeRequirements(shared: ParsedSharedPart): ServiceRequirement[] {
  if (shared.employee === 'none') {
    return [];
  }
  return [
    {
      resourceType: 'employee',
      skills: shared.qualification === null ? [] : [shared.qualification],
      count: 1,
      resourceIds: null,
    },
  ];
}

function policyOf(
  shared: ParsedSharedPart,
  deadline: ParsedSharedPart['cancelUntilMinutes'],
): ChangePolicy {
  return { isAllowed: true, deadlineMinutes: deadline, allowedActors: shared.actors };
}

/**
 * The shared definition a form describes, on top of what the form does not show. The slot rules are
 * made by the engine's own constructor, so a definition can never hold a length the engine refuses.
 * `null` only when a parsed value no longer fits the rules, which `parseServiceInput` already ruled
 * out.
 */
export function definitionOf(shared: ParsedSharedPart, base: DefinitionBase): NewService | null {
  const rules = createSlotRules({
    durationMinutes: shared.durationMinutes,
    preparationMinutes: shared.preparationMinutes,
    cleanupMinutes: shared.cleanupMinutes,
    stepMinutes: base.stepMinutes,
  });
  if (rules.isErr()) {
    return null;
  }
  return {
    name: shared.name,
    description: shared.description,
    category: shared.category,
    isActive: base.isActive,
    rules: rules.value,
    noticeMinutes: shared.noticeMinutes,
    horizonDays: shared.horizonDays,
    requirements: employeeRequirements(shared),
    cancellation: policyOf(shared, shared.cancelUntilMinutes),
    rescheduling: policyOf(shared, shared.changeUntilMinutes),
    information: base.information,
    assignmentMode: base.assignmentMode,
    availability: base.availability,
    requiredDocuments: shared.documents,
    instructions: shared.instructions,
    internalNote: shared.internalNote,
    participantsPerBooking: base.participantsPerBooking,
    participantsPerSession: base.participantsPerSession,
    homeLocationId: base.homeLocationId,
    copiedFromLocationId: base.copiedFromLocationId,
  };
}

/** The fields every location shares: what a change reaches everywhere. */
function sharedFields(service: NewService) {
  const {
    name,
    description,
    category,
    rules,
    noticeMinutes,
    horizonDays,
    requirements,
    cancellation,
    rescheduling,
    requiredDocuments,
    instructions,
    internalNote,
  } = service;
  return {
    name,
    description,
    category,
    rules,
    noticeMinutes,
    horizonDays,
    requirements,
    cancellation,
    rescheduling,
    requiredDocuments,
    instructions,
    internalNote,
  };
}

/** Whether a change touches the definition every location shares. */
export function changesSharedPart(before: NewService, after: NewService): boolean {
  return !deepEqual(sharedFields(before), sharedFields(after));
}

/** A copy of a definition for another location: independent from the moment it is made, with no note of the original's. */
export function copyOf(
  service: StoredService,
  origin: {
    readonly homeLocationId: StoredService['homeLocationId'];
    readonly copiedFromLocationId: StoredService['homeLocationId'];
  },
): NewService {
  return {
    ...definitionOfStored(service),
    internalNote: null,
    isActive: true,
    homeLocationId: origin.homeLocationId,
    copiedFromLocationId: origin.copiedFromLocationId,
  };
}

function definitionOfStored(service: StoredService): NewService {
  return omit(service, ['id', 'updatedAt', 'locations']);
}
