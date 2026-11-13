import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import {
  arrayOf,
  isBoolean,
  isFiniteNumber,
  isInteger,
  isString,
  literalGuard,
  nullable,
  objectOf,
  oneOf,
  unique,
} from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { RESOURCE_TYPES } from '../../domain/models/bookable-resource';
import {
  ASSIGNMENT_MODES,
  CHANGE_ACTORS,
  INFORMATION_FIELDS,
} from '../../domain/models/bookable-service';
import { toBookableResourceId, toBookableServiceId } from '../../domain/models/ids';
import { SCHEDULING_LIMITS } from '../../domain/scheduling/prepare-scheduling';
import { createSlotRules } from '../../domain/scheduling/slot-rules';
import { MAX_HORIZON_DAYS } from '../../domain/scheduling/start-window';
import { parseMinutes } from '../../domain/time/minutes';

import { readOptionalAvailability } from './availability-record-mapper';

import type { ResourceKind } from '../../domain/models/bookable-resource';
import type {
  BookableService,
  ChangeActor,
  ChangePolicy,
  InformationField,
  InformationRequirement,
  ServiceRequirement,
} from '../../domain/models/bookable-service';
import type { ServiceLocationSetting } from '../../domain/models/service-location';

/** The columns the rules read. Prisma's own types stay behind the repository. */
export interface ServiceRecord {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  readonly slotIntervalMinutes: number;
  readonly noticeMinutes: number;
  readonly horizonDays: number;
  readonly requirements: unknown;
  readonly cancellation: unknown;
  readonly rescheduling: unknown;
  readonly information: unknown;
  readonly assignmentMode: string;
  readonly availability: unknown;
}

export const SERVICE_SELECT = [
  'id',
  'name',
  'isActive',
  'durationMinutes',
  'preparationMinutes',
  'cleanupMinutes',
  'slotIntervalMinutes',
  'noticeMinutes',
  'horizonDays',
  'requirements',
  'cancellation',
  'rescheduling',
  'information',
  'assignmentMode',
  'availability',
] as const satisfies ReadonlyArray<keyof ServiceRecord>;

interface StoredRequirement {
  readonly resourceType: ResourceKind;
  readonly skills: string[];
  readonly count: number;
  readonly resourceIds: string[] | null;
}

interface StoredPolicy {
  readonly isAllowed: boolean;
  readonly deadlineMinutes: number;
  readonly allowedActors: string[];
}

interface StoredInformation {
  readonly field: InformationField;
  readonly isRequired: boolean;
}

const isStringList = arrayOf(isString);
const isChangeActor = literalGuard(CHANGE_ACTORS);
const isAssignmentMode = literalGuard(ASSIGNMENT_MODES);

const isRequirement = objectOf<StoredRequirement>({
  resourceType: oneOf(RESOURCE_TYPES),
  skills: isStringList,
  count: isFiniteNumber,
  resourceIds: nullable(isStringList),
});

const isPolicy = objectOf<StoredPolicy>({
  isAllowed: isBoolean,
  deadlineMinutes: isFiniteNumber,
  allowedActors: isStringList,
});

const isInformation = objectOf<StoredInformation>({
  field: oneOf(INFORMATION_FIELDS),
  isRequired: isBoolean,
});

/** The first version stored one actor, `staff`, for "an employee or a manager" (BD-10). */
const LEGACY_ACTORS: Readonly<Record<string, readonly ChangeActor[]>> = {
  staff: ['employee', 'manager'],
};

/** The actors a stored policy names, with the first version's `staff` read as employee and manager. */
function readActors(stored: readonly string[]): ChangeActor[] | null {
  const actors: ChangeActor[] = [];
  for (const name of stored) {
    const expanded = isChangeActor(name) ? [name] : LEGACY_ACTORS[name];
    if (expanded === undefined) {
      return null;
    }
    actors.push(...expanded);
  }
  return unique(actors);
}

function readPolicy(raw: unknown): ChangePolicy | null {
  if (!isPolicy(raw)) {
    return null;
  }
  const deadlineMinutes = parseMinutes(raw.deadlineMinutes);
  const allowedActors = readActors(raw.allowedActors);
  return deadlineMinutes === null || allowedActors === null
    ? null
    : { isAllowed: raw.isAllowed, deadlineMinutes, allowedActors };
}

/** Requirements within the limits the scheduling engine accepts, so no service can make a question it refuses. */
export function readRequirements(raw: unknown): ServiceRequirement[] | null {
  const limits = SCHEDULING_LIMITS;
  if (!arrayOf(isRequirement)(raw) || raw.length > limits.maxRequirements) {
    return null;
  }
  const isCountValid = (count: number) =>
    isInteger(count) && count >= 1 && count <= limits.maxCountPerRequirement;
  if (!raw.every((requirement) => isCountValid(requirement.count))) {
    return null;
  }
  return raw.map((requirement) => ({
    resourceType: requirement.resourceType,
    skills: requirement.skills,
    count: requirement.count,
    resourceIds: requirement.resourceIds?.map(toBookableResourceId) ?? null,
  }));
}

/** The two change policies of a service, both or neither. */
function readPolicies(record: ServiceRecord) {
  const cancellation = readPolicy(record.cancellation);
  const rescheduling = readPolicy(record.rescheduling);
  return cancellation === null || rescheduling === null ? null : { cancellation, rescheduling };
}

const isHorizonValid = (days: number) => isInteger(days) && days >= 1 && days <= MAX_HORIZON_DAYS;

export function toService(
  record: ServiceRecord,
  locations: readonly ServiceLocationSetting[],
): AppResult<BookableService, InfrastructureAppError> {
  const rules = createSlotRules({
    durationMinutes: record.durationMinutes,
    preparationMinutes: record.preparationMinutes,
    cleanupMinutes: record.cleanupMinutes,
    stepMinutes: record.slotIntervalMinutes,
  });
  const noticeMinutes = parseMinutes(record.noticeMinutes);
  const requirements = readRequirements(record.requirements);
  const policies = readPolicies(record);
  const information = arrayOf(isInformation)(record.information) ? record.information : null;
  const availability = readOptionalAvailability(record.availability);
  if (rules.isErr()) {
    return err(bookingDataInvalid('slot rules'));
  }
  if (availability.isErr()) {
    return err(availability.error);
  }
  if (
    noticeMinutes === null ||
    !isAssignmentMode(record.assignmentMode) ||
    !isHorizonValid(record.horizonDays) ||
    requirements === null ||
    policies === null ||
    information === null
  ) {
    return err(bookingDataInvalid('service'));
  }
  return ok({
    id: toBookableServiceId(record.id),
    name: record.name,
    isActive: record.isActive,
    rules: rules.value,
    noticeMinutes,
    horizonDays: record.horizonDays,
    locations,
    requirements,
    ...policies,
    information: information.map((item): InformationRequirement => ({
      field: item.field,
      isRequired: item.isRequired,
    })),
    assignmentMode: record.assignmentMode,
    availability: availability.value,
  });
}
