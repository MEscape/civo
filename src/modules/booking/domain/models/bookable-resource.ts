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
  assignedActorIdMax: 128,
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

/** What somebody other than the employee changed on an employee's calendar. */
export const MANAGER_CHANGE_KINDS = ['hours', 'services'] as const;
export type ManagerChangeKind = (typeof MANAGER_CHANGE_KINDS)[number];

/**
 * A change to an employee's calendar made by a manager, kept until the
 * employee has seen it (by acknowledging it, or by saving their calendar
 * themselves): an employee is never changed behind their back. It names what
 * changed and when, never who.
 */
export interface ManagerChange {
  readonly at: Date;
  readonly kinds: readonly ManagerChangeKind[];
}

/** A manager change as it is stored: a time as text and the kinds by name. */
export interface ManagerChangeInput {
  readonly at: string;
  readonly kinds: readonly string[];
}

/** The change a stored row holds, or `null` when its time does not read. */
export function managerChangeOf(stored: ManagerChangeInput): ManagerChange | null {
  const at = new Date(stored.at);
  if (Number.isNaN(at.getTime())) {
    return null;
  }
  return { at, kinds: MANAGER_CHANGE_KINDS.filter((kind) => stored.kinds.includes(kind)) };
}

/** The same change with one more kind of change, at the time given: several changes before the employee looks read as one. */
export function withManagerChange(
  current: ManagerChange | null,
  change: { readonly kind: ManagerChangeKind; readonly at: Date },
): ManagerChange {
  const kinds = new Set([...(current?.kinds ?? []), change.kind]);
  return { at: change.at, kinds: MANAGER_CHANGE_KINDS.filter((kind) => kinds.has(kind)) };
}

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
  /**
   * The employee (a member of the tenant) whose calendar this is, or `null`. Only an
   * `employee` resource has one: it is the employee's own, made and kept by them. The
   * person sees the bookings of this resource and no others.
   */
  readonly assignedActorId: string | null;
  /** What a manager changed here that the employee has not seen yet; `null` for none. */
  readonly managerChange: ManagerChange | null;
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
  readonly assignedActorId?: string | null | undefined;
  readonly managerChange?: ManagerChange | null | undefined;
}

export type BookableResourceDraft = Omit<
  BookableResource,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
>;

/** What a stored resource is made of, without identity and timestamps: the starting point for changing one part of it. */
export function draftOfResource(resource: BookableResource): BookableResourceDraft {
  return {
    websiteId: resource.websiteId,
    locationId: resource.locationId,
    name: resource.name,
    type: resource.type,
    skills: resource.skills,
    capacity: resource.capacity,
    availability: resource.availability,
    isActive: resource.isActive,
    assignedActorId: resource.assignedActorId,
    managerChange: resource.managerChange,
  };
}

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

/** Who a resource belongs to. Only an employee resource has an owner. */
function parseAssignment(
  input: BookableResourceInput,
  type: ResourceKind | null,
  bag: FieldErrorBag,
): { readonly assignedActorId: string | null } {
  const trimmedActor = input.assignedActorId?.trim() ?? '';
  const assignedActorId = trimmedActor === '' ? null : trimmedActor;
  const isTooLong =
    assignedActorId !== null && assignedActorId.length > RESOURCE_LIMITS.assignedActorIdMax;
  const isNotAnEmployee = assignedActorId !== null && type !== 'employee';
  if (isTooLong || isNotAnEmployee) {
    bag.add('assignedActorId', CODES.assignmentInvalid);
  }
  return { assignedActorId };
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
  const assignment = parseAssignment(input, type, bag);
  // A person is at one place at a time: only equipment that travels may belong to every location.
  if (type === 'employee' && input.locationId === null) {
    bag.add('locationId', CODES.locationsRequired);
  }

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
    managerChange: input.managerChange ?? null,
    ...assignment,
  });
}
