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
import { parseBookingLocationId } from './ids';

import type { AvailabilityPlan, AvailabilityPlanInput } from './availability-plan';
import type { BookableResourceId, BookingLocationId, WebsiteId } from './ids';

export const RESOURCE_LIMITS = {
  nameMax: 120,
  skillsMax: 30,
  skillMax: 64,
  capacityMax: 10_000,
} as const;

/**
 * What a resource is. Employees are one type among several, so a passport
 * appointment (an employee) and a pitch reservation (a facility) are handled
 * by the same scheduling engine; the type only decides which requirement a
 * resource can satisfy.
 */
export const RESOURCE_TYPES = [
  'employee',
  'room',
  'office',
  'service-desk',
  'sports-field',
  'meeting-room',
  'vehicle',
  'equipment',
  'facility',
  'workstation',
  'other',
] as const;
export type ResourceKind = (typeof RESOURCE_TYPES)[number];

/** A qualification key such as `identity-services`: lower-case words joined by hyphens. */
export const SKILL_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Something that can be reserved: a person, a room, a pitch, a device.
 *
 * `capacity` is the PHYSICAL limit of the resource (a room that holds 20),
 * which is a different thing from whether the resource is free at a given
 * time, and from how many places a service sells for a session. `null` means
 * the resource imposes no limit of its own.
 *
 * `availability` is the resource's own working or opening schedule. `null`
 * means it follows its location's opening hours, which is what a club room
 * wants and an employee does not.
 */
export interface BookableResource {
  readonly id: BookableResourceId;
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
  /** `null`: not tied to one place (a mobile unit); it can serve any location. */
  readonly locationId: BookingLocationId | null;
  readonly name: string;
  readonly type: ResourceKind;
  readonly skills: readonly string[];
  readonly capacity: number | null;
  readonly availability: AvailabilityPlan | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface BookableResourceInput {
  readonly websiteId: WebsiteId;
  readonly locationId: string | null;
  readonly name: string;
  readonly type: string;
  readonly skills: readonly string[];
  readonly capacity: number | null;
  readonly availability: AvailabilityPlanInput | null;
  readonly isActive: boolean;
}

export type BookableResourceDraft = Omit<
  BookableResource,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
>;

/** Whether a resource may serve a location: it belongs there, or belongs nowhere in particular. */
export function servesLocation(resource: BookableResource, locationId: BookingLocationId): boolean {
  return resource.locationId === null || resource.locationId === locationId;
}

function parseSkills(skills: readonly string[], bag: FieldErrorBag): string[] {
  if (skills.length > RESOURCE_LIMITS.skillsMax) {
    bag.add('skills', CODES.tooMany);
  }
  const normalized = [...new Set(skills.map((skill) => skill.trim()))];
  for (const skill of normalized) {
    if (skill.length > RESOURCE_LIMITS.skillMax || !SKILL_KEY_PATTERN.test(skill)) {
      bag.add('skills', CODES.skillInvalid);
    }
  }
  return normalized.sort();
}

function parseName(raw: string, bag: FieldErrorBag): string {
  const name = raw.trim();
  if (name === '') {
    bag.add('name', CODES.nameRequired);
  } else if (name.length > RESOURCE_LIMITS.nameMax) {
    bag.add('name', CODES.textTooLong);
  }
  return name;
}

function checkCapacity(capacity: number | null, bag: FieldErrorBag): void {
  if (capacity === null) {
    return;
  }
  const isInRange =
    Number.isInteger(capacity) && capacity >= 1 && capacity <= RESOURCE_LIMITS.capacityMax;
  if (!isInRange) {
    bag.add('capacity', CODES.capacityInvalid);
  }
}

function parseLocation(raw: string | null, bag: FieldErrorBag): BookingLocationId | null {
  if (raw === null) {
    return null;
  }
  const parsed = parseBookingLocationId(raw);
  if (parsed.isErr()) {
    bag.add('locationId', CODES.idInvalid);
    return null;
  }
  return parsed.value;
}

function parseAvailability(
  raw: BookableResourceInput['availability'],
  bag: FieldErrorBag,
): AvailabilityPlan | null {
  if (raw === null) {
    return null;
  }
  const plan = createAvailabilityPlan(raw);
  if (plan.isErr()) {
    addFieldErrors(bag, plan.error);
    return null;
  }
  return plan.value;
}

export function createBookableResourceDraft(
  input: BookableResourceInput,
): AppResult<BookableResourceDraft, ValidationAppError> {
  const bag = createBookingErrorBag();

  const name = parseName(input.name, bag);
  const type = RESOURCE_TYPES.find((candidate) => candidate === input.type) ?? null;
  if (type === null) {
    bag.add('type', CODES.resourceTypeUnknown);
  }
  const skills = parseSkills(input.skills, bag);
  checkCapacity(input.capacity, bag);
  const locationId = parseLocation(input.locationId, bag);
  const availability = parseAvailability(input.availability, bag);

  if (bag.hasErrors || type === null) {
    return err(bag.toError());
  }

  return ok({
    websiteId: input.websiteId,
    locationId,
    name,
    type,
    skills,
    capacity: input.capacity,
    availability,
    isActive: input.isActive,
  });
}
