import type { ResourceKind } from './bookable-resource';
import type { BookableResourceId, BookableServiceId } from './ids';
import type { ServiceLocationSetting } from './service-location';
import type { AvailabilityPlan } from '../scheduling/availability-plan';
import type { SlotRules } from '../scheduling/slot-rules';
import type { Minutes } from '../time/minutes';

/** Who performs a cancellation or reschedule. Proposed decision BD-10: three actors. */
export const CHANGE_ACTORS = ['customer', 'employee', 'manager'] as const;
export type ChangeActor = (typeof CHANGE_ACTORS)[number];

/**
 * Whether and until when a booking can be changed, and by whom. The deadline binds customers only:
 * after it, only employees and managers may still change the booking (the service form says so:
 * "afterwards only by employees").
 */
export interface ChangePolicy {
  readonly isAllowed: boolean;
  /** Customers may change a booking until this many minutes before it starts. */
  readonly deadlineMinutes: Minutes;
  readonly allowedActors: readonly ChangeActor[];
}

/**
 * How employee requirements are filled. Proposed decision BD-07 (not yet confirmed):
 *  - `automatic`: the booking is made with employees already assigned (today's behaviour);
 *  - `manual`: the booking is made without them, a manager assigns;
 *  - `open`: the booking is made without them, a qualified employee may claim it.
 * Only employee requirements can be left unassigned; a room or a desk is always held.
 */
export const ASSIGNMENT_MODES = ['automatic', 'manual', 'open'] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];

/**
 * One kind of resource a service needs, and how many of them at once. "A qualified employee" is
 * `{ resourceType: 'employee', skills: ['identity-services'], count: 1 }`; "a room and a host" is
 * two requirements. `resourceIds`, when set, narrows the pool to those resources.
 */
export interface ServiceRequirement {
  readonly resourceType: ResourceKind;
  readonly skills: readonly string[];
  readonly count: number;
  readonly resourceIds: readonly BookableResourceId[] | null;
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
 * Something a visitor can book, reduced to what the lifecycle, policy, assignment and impact rules
 * read. Duration, buffers and step are the scheduling engine's `SlotRules`; the notice and the
 * horizon are turned into a start window with `createStartWindow`. The rest of the description
 * (the text a visitor reads, the documents to bring) belongs to the administration of services.
 */
export interface BookableService {
  readonly id: BookableServiceId;
  /** What the service is called; a booking keeps the name it was made under (`ServiceSnapshot`). */
  readonly name: string;
  readonly isActive: boolean;
  readonly rules: SlotRules;
  readonly noticeMinutes: Minutes;
  readonly horizonDays: number;
  /** Where the service is switched on, with what is local to each place. */
  readonly locations: readonly ServiceLocationSetting[];
  /**
   * The shared requirement: the employee and the qualification. The physical resources are the
   * locations' own (`serviceAtLocation` puts them together).
   */
  readonly requirements: readonly ServiceRequirement[];
  readonly cancellation: ChangePolicy;
  readonly rescheduling: ChangePolicy;
  readonly information: readonly InformationRequirement[];
  readonly assignmentMode: AssignmentMode;
  /** When the service itself can be booked, narrowing the location's hours. `null`: whenever the location is open. */
  readonly availability: AvailabilityPlan | null;
}
