import type { TenantId } from '@modules/auth';

import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { ok, err } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  addFieldErrors,
  createBookingErrorBag,
} from '../errors/booking-errors';

import { createAvailabilityPlan } from './availability-plan';
import { RESOURCE_TYPES, SKILL_KEY_PATTERN } from './bookable-resource';
import { parseBookableResourceId, parseBookingLocationId } from './ids';
import { blankToNull } from './text';

import type { AvailabilityPlan, AvailabilityPlanInput } from './availability-plan';
import type { ResourceKind } from './bookable-resource';
import type { BookableResourceId, BookableServiceId, BookingLocationId, WebsiteId } from './ids';

export const SERVICE_LIMITS = {
  nameMax: 120,
  descriptionMax: 2000,
  categoryMax: 64,
  instructionsMax: 2000,
  documentMax: 200,
  documentsMax: 20,
  durationMin: 5,
  durationMax: 1440,
  bufferMax: 240,
  slotIntervalMin: 5,
  slotIntervalMax: 240,
  /** A year. */
  noticeMax: 525_600,
  horizonDaysMax: 730,
  participantsMax: 500,
  requirementsMax: 6,
  requirementCountMax: 20,
  skillsPerRequirementMax: 10,
  poolMax: 100,
  locationsMax: 50,
  deadlineMax: 525_600,
} as const;

/** Who performs a cancellation or reschedule: the person who booked, or someone on the staff. */
export const CHANGE_ACTORS = ['customer', 'staff'] as const;
export type ChangeActor = (typeof CHANGE_ACTORS)[number];

/**
 * Whether and until when a booking can be changed, and by whom. The deadline
 * binds customers; staff are bound only by `isAllowed` and `allowedActors`,
 * because a receptionist cancelling an hour before is routine and a citizen
 * doing so may not be.
 */
export interface ChangePolicy {
  readonly isAllowed: boolean;
  /** Customers may change a booking until this many minutes before it starts. */
  readonly deadlineMinutes: number;
  readonly allowedActors: readonly ChangeActor[];
}

/** What the booking form can ask for. A closed list on purpose: this is not a form builder. */
export const INFORMATION_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'referenceNumber',
  'notes',
] as const;
export type InformationField = (typeof INFORMATION_FIELDS)[number];

export interface InformationRequirement {
  readonly field: InformationField;
  readonly isRequired: boolean;
}

/**
 * One kind of resource a service needs, and how many of them. "A qualified
 * employee" is `{ resourceType: 'employee', skills: ['identity-services'],
 * count: 1 }`; "a room and a host" is two requirements. `resourceIds`, when
 * set, narrows the pool to those resources (a service for exactly one pitch).
 */
export interface ResourceRequirement {
  readonly resourceType: ResourceKind;
  readonly skills: readonly string[];
  readonly count: number;
  readonly resourceIds: readonly BookableResourceId[] | null;
}

/**
 * Participants are counted in two places that must not be mixed up:
 * `participantsPerBooking` is the largest group one booking may bring, and
 * `participantsPerSession` is how many participants all bookings of one
 * session (same service, same start) may add up to. With a session limit of
 * one, a booking holds its resources alone. With a larger limit, bookings of
 * the same start share the session's resources until it is full: a workshop.
 */
export interface ServiceCapacity {
  readonly participantsPerBooking: number;
  readonly participantsPerSession: number;
}

/**
 * Something a visitor can book. It says what is booked, for how long, which
 * resources and qualifications it needs, where it is offered and under which
 * rules; WHEN it can be booked is the intersection of the location's hours,
 * the resources' schedules, the service's own `availability` and the notice
 * and horizon below.
 *
 * The appointment lasts `durationMinutes`. The resources are occupied for
 * `preparationMinutes + durationMinutes + cleanupMinutes`, and conflicts are
 * checked against that whole span.
 */
export interface BookableService {
  readonly id: BookableServiceId;
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
  readonly name: string;
  readonly description: string | null;
  /** A key the booking component can filter on ("citizen-services"). */
  readonly category: string | null;
  readonly isActive: boolean;
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  /** Distance between offered start times. */
  readonly slotIntervalMinutes: number;
  readonly locationIds: readonly BookingLocationId[];
  readonly requirements: readonly ResourceRequirement[];
  readonly capacity: ServiceCapacity;
  /** The earliest a booking may start, counted from now. */
  readonly noticeMinutes: number;
  /** The furthest ahead a booking may be made, in local calendar days. */
  readonly horizonDays: number;
  /** Extra restriction on top of the location's hours; `null` means none. */
  readonly availability: AvailabilityPlan | null;
  readonly cancellation: ChangePolicy;
  readonly rescheduling: ChangePolicy;
  readonly information: readonly InformationRequirement[];
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ChangePolicyInput {
  readonly isAllowed: boolean;
  readonly deadlineMinutes: number;
  readonly allowedActors: readonly string[];
}

export interface ResourceRequirementInput {
  readonly resourceType: string;
  readonly skills: readonly string[];
  readonly count: number;
  readonly resourceIds: readonly string[] | null;
}

export interface BookableServiceInput {
  readonly websiteId: WebsiteId;
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly isActive: boolean;
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  readonly slotIntervalMinutes: number;
  readonly locationIds: readonly string[];
  readonly requirements: readonly ResourceRequirementInput[];
  readonly participantsPerBooking: number;
  readonly participantsPerSession: number;
  readonly noticeMinutes: number;
  readonly horizonDays: number;
  readonly availability: AvailabilityPlanInput | null;
  readonly cancellation: ChangePolicyInput;
  readonly rescheduling: ChangePolicyInput;
  readonly information: ReadonlyArray<{ readonly field: string; readonly isRequired: boolean }>;
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
}

export type BookableServiceDraft = Omit<
  BookableService,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
>;

function isIntegerBetween(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

interface TextRule {
  readonly field: string;
  readonly value: string | null;
  readonly max: number;
  readonly isRequired?: boolean;
}

function checkText(
  bag: FieldErrorBag,
  { field, value, max, isRequired = false }: TextRule,
): string | null {
  const text = blankToNull(value);
  if (text === null) {
    if (isRequired) {
      bag.add(field, CODES.nameRequired);
    }
    return null;
  }
  if (text.length > max) {
    bag.add(field, CODES.textTooLong);
  }
  return text;
}

function parseTiming(input: BookableServiceInput, bag: FieldErrorBag): void {
  if (
    !isIntegerBetween(input.durationMinutes, SERVICE_LIMITS.durationMin, SERVICE_LIMITS.durationMax)
  ) {
    bag.add('durationMinutes', CODES.durationInvalid);
  }
  for (const field of ['preparationMinutes', 'cleanupMinutes'] as const) {
    if (!isIntegerBetween(input[field], 0, SERVICE_LIMITS.bufferMax)) {
      bag.add(field, CODES.bufferInvalid);
    }
  }
  if (
    !isIntegerBetween(
      input.slotIntervalMinutes,
      SERVICE_LIMITS.slotIntervalMin,
      SERVICE_LIMITS.slotIntervalMax,
    )
  ) {
    bag.add('slotIntervalMinutes', CODES.slotIntervalInvalid);
  }
  if (!isIntegerBetween(input.noticeMinutes, 0, SERVICE_LIMITS.noticeMax)) {
    bag.add('noticeMinutes', CODES.noticeInvalid);
  }
  if (!isIntegerBetween(input.horizonDays, 1, SERVICE_LIMITS.horizonDaysMax)) {
    bag.add('horizonDays', CODES.horizonInvalid);
  }
}

function parseCapacity(input: BookableServiceInput, bag: FieldErrorBag): void {
  if (!isIntegerBetween(input.participantsPerBooking, 1, SERVICE_LIMITS.participantsMax)) {
    bag.add('participantsPerBooking', CODES.capacityInvalid);
  }
  if (
    !isIntegerBetween(input.participantsPerSession, 1, SERVICE_LIMITS.participantsMax) ||
    input.participantsPerSession < input.participantsPerBooking
  ) {
    bag.add('participantsPerSession', CODES.capacityInvalid);
  }
}

function parseLocations(ids: readonly string[], bag: FieldErrorBag): readonly BookingLocationId[] {
  if (ids.length === 0) {
    bag.add('locationIds', CODES.locationsRequired);
  }
  if (ids.length > SERVICE_LIMITS.locationsMax) {
    bag.add('locationIds', CODES.tooMany);
  }
  return [...new Set(ids)].flatMap((raw) => {
    const parsed = parseBookingLocationId(raw);
    if (parsed.isErr()) {
      bag.add('locationIds', CODES.idInvalid);
      return [];
    }
    return [parsed.value];
  });
}

function parseSkillList(skills: readonly string[], path: string, bag: FieldErrorBag): string[] {
  if (skills.length > SERVICE_LIMITS.skillsPerRequirementMax) {
    bag.add(path, CODES.tooMany);
  }
  const normalized = [...new Set(skills.map((skill) => skill.trim()))];
  if (normalized.some((skill) => !SKILL_KEY_PATTERN.test(skill))) {
    bag.add(path, CODES.skillInvalid);
  }
  return normalized.sort();
}

function parsePool(
  ids: readonly string[] | null,
  path: string,
  bag: FieldErrorBag,
): readonly BookableResourceId[] | null {
  if (ids === null) {
    return null;
  }
  if (ids.length === 0 || ids.length > SERVICE_LIMITS.poolMax) {
    bag.add(path, CODES.requirementCountInvalid);
  }
  return [...new Set(ids)].flatMap((raw) => {
    const parsed = parseBookableResourceId(raw);
    if (parsed.isErr()) {
      bag.add(path, CODES.idInvalid);
      return [];
    }
    return [parsed.value];
  });
}

function parseRequirements(
  inputs: readonly ResourceRequirementInput[],
  bag: FieldErrorBag,
): readonly ResourceRequirement[] {
  if (inputs.length === 0) {
    bag.add('requirements', CODES.requirementsRequired);
  }
  if (inputs.length > SERVICE_LIMITS.requirementsMax) {
    bag.add('requirements', CODES.tooMany);
  }

  return inputs.slice(0, SERVICE_LIMITS.requirementsMax).flatMap((input, index) => {
    const path = `requirements.${index}`;
    const resourceType = RESOURCE_TYPES.find((type) => type === input.resourceType) ?? null;
    if (resourceType === null) {
      bag.add(`${path}.resourceType`, CODES.resourceTypeUnknown);
    }
    if (!isIntegerBetween(input.count, 1, SERVICE_LIMITS.requirementCountMax)) {
      bag.add(`${path}.count`, CODES.requirementCountInvalid);
    }
    const skills = parseSkillList(input.skills, `${path}.skills`, bag);
    const resourceIds = parsePool(input.resourceIds, `${path}.resourceIds`, bag);
    return resourceType === null ? [] : [{ resourceType, skills, count: input.count, resourceIds }];
  });
}

function parseChangePolicy(
  input: ChangePolicyInput,
  path: string,
  bag: FieldErrorBag,
): ChangePolicy {
  if (!isIntegerBetween(input.deadlineMinutes, 0, SERVICE_LIMITS.deadlineMax)) {
    bag.add(`${path}.deadlineMinutes`, CODES.changePolicyInvalid);
  }
  const allowedActors = CHANGE_ACTORS.filter((actor) => input.allowedActors.includes(actor));
  if (allowedActors.length !== new Set(input.allowedActors).size) {
    bag.add(`${path}.allowedActors`, CODES.actorUnknown);
  }
  if (input.isAllowed && allowedActors.length === 0) {
    bag.add(`${path}.allowedActors`, CODES.changePolicyInvalid);
  }
  return {
    isAllowed: input.isAllowed,
    deadlineMinutes: input.deadlineMinutes,
    allowedActors,
  };
}

function parseInformation(
  inputs: BookableServiceInput['information'],
  bag: FieldErrorBag,
): readonly InformationRequirement[] {
  const seen = new Set<string>();
  const parsed = inputs.flatMap((input) => {
    const field = INFORMATION_FIELDS.find((candidate) => candidate === input.field) ?? null;
    if (field === null || seen.has(field)) {
      bag.add('information', CODES.informationFieldUnknown);
      return [];
    }
    seen.add(field);
    return [{ field, isRequired: input.isRequired }];
  });

  // The e-mail address is how a visitor is confirmed to and how they later prove a booking is theirs.
  const email = parsed.find((requirement) => requirement.field === 'email');
  if (email?.isRequired !== true) {
    bag.add('information', CODES.emailRequired);
  }
  return INFORMATION_FIELDS.flatMap((field) => parsed.filter((entry) => entry.field === field));
}

function parseDocuments(documents: readonly string[], bag: FieldErrorBag): readonly string[] {
  if (documents.length > SERVICE_LIMITS.documentsMax) {
    bag.add('requiredDocuments', CODES.tooMany);
  }
  const texts = documents.map((document) => document.trim()).filter((text) => text !== '');
  if (texts.some((text) => text.length > SERVICE_LIMITS.documentMax)) {
    bag.add('requiredDocuments', CODES.textTooLong);
  }
  return texts;
}

const CATEGORY_PATTERN = SKILL_KEY_PATTERN;

/**
 * Builds a service from editor input, collecting every problem in one pass.
 * The invariants that hold afterwards are the ones scheduling relies on:
 * positive durations, a slot grid, at least one location, at least one
 * resource requirement, a session at least as large as a booking, and an
 * e-mail address that is always asked for.
 */
export function createBookableServiceDraft(
  input: BookableServiceInput,
): AppResult<BookableServiceDraft, ValidationAppError> {
  const bag = createBookingErrorBag();

  const name = checkText(bag, {
    field: 'name',
    value: input.name,
    max: SERVICE_LIMITS.nameMax,
    isRequired: true,
  });
  const description = checkText(bag, {
    field: 'description',
    value: input.description,
    max: SERVICE_LIMITS.descriptionMax,
  });
  const instructions = checkText(bag, {
    field: 'instructions',
    value: input.instructions,
    max: SERVICE_LIMITS.instructionsMax,
  });
  const category = blankToNull(input.category);
  if (
    category !== null &&
    (category.length > SERVICE_LIMITS.categoryMax || !CATEGORY_PATTERN.test(category))
  ) {
    bag.add('category', CODES.categoryInvalid);
  }

  parseTiming(input, bag);
  parseCapacity(input, bag);
  const locationIds = parseLocations(input.locationIds, bag);
  const requirements = parseRequirements(input.requirements, bag);
  const cancellation = parseChangePolicy(input.cancellation, 'cancellation', bag);
  const rescheduling = parseChangePolicy(input.rescheduling, 'rescheduling', bag);
  const information = parseInformation(input.information, bag);
  const requiredDocuments = parseDocuments(input.requiredDocuments, bag);

  const availability =
    input.availability === null ? null : createAvailabilityPlan(input.availability);
  if (availability?.isErr() === true) {
    addFieldErrors(bag, availability.error);
  }

  if (bag.hasErrors || name === null) {
    return err(bag.toError());
  }

  return ok({
    websiteId: input.websiteId,
    name,
    description,
    category,
    isActive: input.isActive,
    durationMinutes: input.durationMinutes,
    preparationMinutes: input.preparationMinutes,
    cleanupMinutes: input.cleanupMinutes,
    slotIntervalMinutes: input.slotIntervalMinutes,
    locationIds,
    requirements,
    capacity: {
      participantsPerBooking: input.participantsPerBooking,
      participantsPerSession: input.participantsPerSession,
    },
    noticeMinutes: input.noticeMinutes,
    horizonDays: input.horizonDays,
    availability: availability?.isOk() === true ? availability.value : null,
    cancellation,
    rescheduling,
    information,
    requiredDocuments,
    instructions,
  });
}
