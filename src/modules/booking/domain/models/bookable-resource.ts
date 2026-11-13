import { isSentTo } from './employee-coverage';

import type { CoverageSpell } from './employee-coverage';
import type { BookableResourceId, BookingLocationId } from './ids';
import type { AvailabilityPlan } from '../scheduling/availability-plan';
import type { Minutes } from '../time/minutes';

/**
 * What a resource is. An employee is one type among several, so a passport appointment (an
 * employee) and a pitch reservation (a facility) are handled by the same engine; the type only
 * decides which requirement of a service a resource can satisfy. The list is the database enum
 * `ResourceKind` (a test fails when they drift).
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

/**
 * What the booking rules need to know about a resource, apart from its calendar (which is a
 * `ResourceSchedule` of the scheduling engine). An employee works at exactly one location, so an
 * employee's `locationId` is never `null`; other resources may serve every location (`null`).
 */
export interface BookableResource {
  readonly id: BookableResourceId;
  /** What it is called where it is chosen: "Schalter 1". */
  readonly name: string;
  readonly type: ResourceKind;
  /** How many can use it at once; `null`: not stated. */
  readonly capacity: number | null;
  /** Capability keys. A requirement is met only by a resource that holds all of its skills. */
  readonly skills: readonly string[];
  readonly locationId: BookingLocationId | null;
  readonly isActive: boolean;
  /** Held this long before and after an appointment. An employee is held for the service's buffers instead. */
  readonly setupMinutes: Minutes;
  readonly teardownMinutes: Minutes;
  /** When the resource works, inside the location's hours. `null`: whenever the location is open. */
  readonly availability: AvailabilityPlan | null;
  /** Days an employee works at another location instead of their own; none for anything else. */
  readonly coverage: readonly CoverageSpell[];
}

/**
 * How many bookings the resource takes at once: its capacity, or one when none is stated. An
 * employee serves one appointment at a time whatever is stored.
 */
export function placesOf(resource: Pick<BookableResource, 'type' | 'capacity'>): number {
  return resource.type === 'employee' ? 1 : (resource.capacity ?? 1);
}

/**
 * Whether the resource can serve the location at all: it is its own, it serves every location, or an
 * employee is sent there on some days. On which days is for the schedule to say (`scheduleOf`).
 */
export function servesLocation(resource: BookableResource, locationId: BookingLocationId): boolean {
  return (
    resource.locationId === null ||
    resource.locationId === locationId ||
    isSentTo(resource, locationId)
  );
}
