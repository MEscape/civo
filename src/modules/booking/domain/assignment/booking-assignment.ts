import type { ConflictAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../errors/booking-errors';
import { isActionAllowed, requireAction } from '../lifecycle/booking-actions';
import { hasStarted } from '../lifecycle/booking-lifecycle';
import { hasOpenUnits } from '../models/booking';

import type { EligibleCandidate } from './assignment-eligibility';
import type { BookableService } from '../models/bookable-service';
import type { Assignment, Booking } from '../models/booking';
import type { BookableResourceId } from '../models/ids';
import type { Instant } from '../time/instant';

/**
 * Whether the booking still waits for an employee, has all of them, or has an assignment that no
 * longer holds. The first two are read from the booking; the third is computed by comparing the
 * booking with what changed (`findAffectedBookings`) and handed in, never stored (BD-04). A booking
 * that is over (cancelled, completed) has no assignment state worth showing, and the caller does
 * not ask.
 */
export type AssignmentState = 'open' | 'assigned' | 'conflict';

export function assignmentStateOf(booking: Booking, hasConflict: boolean): AssignmentState {
  if (hasConflict) {
    return 'conflict';
  }
  return hasOpenUnits(booking) ? 'open' : 'assigned';
}

/** Whether the resource already holds a unit of that requirement. */
export function holdsUnitOf(
  booking: Booking,
  requirementIndex: number,
  resourceId: BookableResourceId,
): boolean {
  return booking.assignments.some(
    (unit) => unit.requirementIndex === requirementIndex && unit.resourceId === resourceId,
  );
}

/** What `findOpenUnit` answers when no unit of the requirement waits for an employee. */
export const NO_UNIT = -1;

/** The position of the first unit of the requirement that waits for an employee, or `NO_UNIT`. */
export function findOpenUnit(booking: Booking, requirementIndex: number): number {
  return booking.assignments.findIndex(
    (unit) => unit.requirementIndex === requirementIndex && unit.resourceId === null,
  );
}

/** Why an assignment cannot be handed back. */
export type ReleaseDenial = 'not-assigned' | 'booking-started' | 'unassign-not-allowed';

/**
 * Which unit hands back, or why none can. The one rule behind `releaseAssignment`, the impact
 * analysis and the day plan's "hand back" button. Once the appointment has begun nobody hands it
 * back, a manager included: an open unit then could never be filled or completed again.
 */
export type ReleasePlan =
  | { readonly kind: 'release'; readonly index: number }
  | { readonly kind: 'denied'; readonly denial: ReleaseDenial };

export interface ReleaseInput {
  readonly booking: Booking;
  readonly service: BookableService;
  readonly resourceId: BookableResourceId;
  readonly now: Instant;
}

export function planRelease({ booking, service, resourceId, now }: ReleaseInput): ReleasePlan {
  const index = booking.assignments.findIndex((unit) => unit.resourceId === resourceId);
  const unit = booking.assignments[index];
  if (unit === undefined) {
    return { kind: 'denied', denial: 'not-assigned' };
  }
  if (hasStarted(booking, now)) {
    return { kind: 'denied', denial: 'booking-started' };
  }
  const isFixed = service.assignmentMode === 'automatic' || unit.resourceType !== 'employee';
  return isFixed ? { kind: 'denied', denial: 'unassign-not-allowed' } : { kind: 'release', index };
}

/**
 * What a manager may still change about who serves the booking, as the screens offer it: replace an
 * employee while the booking is confirmed and has not begun (`replaceAssignment`), and take one off
 * only where `planRelease` lets them, so never for a service assigned at booking time.
 */
export function assignmentChangesOf(
  booking: Booking,
  service: BookableService,
  now: Instant,
): { readonly mayReplace: boolean; readonly mayRemove: boolean } {
  const mayReplace = isActionAllowed(booking.status, 'assign') && !hasStarted(booking, now);
  return { mayReplace, mayRemove: mayReplace && service.assignmentMode !== 'automatic' };
}

/** The booking with the unit at `index` changed; `updatedAt` is the caller's to set. */
function changeUnit(
  booking: Booking,
  index: number,
  change: (unit: Assignment) => Assignment,
): Booking {
  return {
    ...booking,
    assignments: booking.assignments.map((unit, position) =>
      position === index ? change(unit) : unit,
    ),
  };
}

export interface AssignInput {
  readonly booking: Booking;
  /** A candidate that `assessEligibility` accepted for this booking and requirement. */
  readonly candidate: EligibleCandidate;
  readonly now: Instant;
}

/**
 * Gives an open unit of the candidate's requirement to the candidate. Safe to repeat: a candidate
 * who already holds a unit of that requirement gets the booking back unchanged, so a claim that is
 * sent twice succeeds twice. When someone else took the last open unit first, the answer is
 * `booking.already_assigned`, and the caller shows the booking as taken.
 */
export function assignResource(input: AssignInput): AppResult<Booking, ConflictAppError> {
  const { booking, candidate, now } = input;
  const allowed = requireAction(booking, 'assign');
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  if (candidate.bookingId !== booking.id) {
    return err(
      bookingConflict(CODES.notEligible, 'The candidate was checked for another booking.'),
    );
  }
  const resourceId = candidate.resource.id;
  if (holdsUnitOf(booking, candidate.requirementIndex, resourceId)) {
    return ok(booking);
  }
  const index = findOpenUnit(booking, candidate.requirementIndex);
  if (index === NO_UNIT) {
    return err(bookingConflict(CODES.alreadyAssigned, 'The booking has already been taken.'));
  }
  return ok({
    ...changeUnit(booking, index, (unit) => ({ ...unit, resourceId })),
    updatedAt: now,
  });
}

const RELEASE_REFUSALS = {
  'not-assigned': [CODES.notAssigned, 'The resource is not on this booking.'],
  'booking-started': [CODES.bookingStarted, 'The appointment has begun; who serves it stays.'],
  'unassign-not-allowed': [CODES.unassignNotAllowed, 'This assignment cannot be handed back.'],
} as const satisfies Record<ReleaseDenial, readonly [string, string]>;

function refusal(denial: ReleaseDenial): ConflictAppError {
  const [code, message] = RELEASE_REFUSALS[denial];
  return bookingConflict(code, message);
}

/**
 * Hands an employee's unit back, so it is open again. Only employee units can be handed back, only
 * before the appointment begins, and only for a service that is assigned later: for one assigned at
 * booking time an employee is always on the booking, and replacing one is `replaceAssignment`. The
 * booking itself is never cancelled by this.
 */
export function releaseAssignment(input: ReleaseInput): AppResult<Booking, ConflictAppError> {
  const { booking, now } = input;
  const allowed = requireAction(booking, 'unassign');
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  const plan = planRelease(input);
  if (plan.kind === 'denied') {
    return err(refusal(plan.denial));
  }
  return ok({
    ...changeUnit(booking, plan.index, (unit) => ({ ...unit, resourceId: null })),
    updatedAt: now,
  });
}

/**
 * Takes a resource off the booking because it is no longer there to serve it (an absence, new hours,
 * sent elsewhere, taken out of the team): the units it held are open again and the booking stays
 * confirmed, so somebody else can take them. This is a fact, not a choice, so it applies whatever the
 * service's assignment mode (`planRelease` is about what a person may hand back). `null` when there is
 * nothing to do: the booking is not confirmed, has begun (who serves it stays) or the resource is not on it.
 */
export function withdrawResource(
  booking: Booking,
  resourceId: BookableResourceId,
  now: Instant,
): Booking | null {
  const isHeld = booking.assignments.some((unit) => unit.resourceId === resourceId);
  if (!isHeld || !isActionAllowed(booking.status, 'unassign') || hasStarted(booking, now)) {
    return null;
  }
  return {
    ...booking,
    assignments: booking.assignments.map((unit) =>
      unit.resourceId === resourceId ? { ...unit, resourceId: null } : unit,
    ),
    updatedAt: now,
  };
}

export interface ReplaceInput {
  readonly booking: Booking;
  /** The resource whose unit the candidate takes over. */
  readonly replaced: BookableResourceId;
  /** A candidate that `assessEligibility` accepted for this booking and that unit's requirement. */
  readonly candidate: EligibleCandidate;
  readonly now: Instant;
}

/**
 * Gives the unit `replaced` holds to the candidate in one step, whatever the service's assignment
 * mode: the unit is never open on the way, so a booking assigned at booking time keeps an employee.
 * Only while the booking is confirmed and has not begun. Sent twice, the second finds the candidate
 * on the unit and the booking comes back unchanged.
 */
export function replaceAssignment(input: ReplaceInput): AppResult<Booking, ConflictAppError> {
  const { booking, replaced, candidate, now } = input;
  const allowed = requireAction(booking, 'assign');
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  if (hasStarted(booking, now)) {
    return err(refusal('booking-started'));
  }
  if (candidate.bookingId !== booking.id) {
    return err(
      bookingConflict(CODES.notEligible, 'The candidate was checked for another booking.'),
    );
  }
  const { requirementIndex } = candidate;
  const resourceId = candidate.resource.id;
  const index = booking.assignments.findIndex(
    (unit) => unit.requirementIndex === requirementIndex && unit.resourceId === replaced,
  );
  if (holdsUnitOf(booking, requirementIndex, resourceId)) {
    return index === NO_UNIT
      ? ok(booking)
      : err(bookingConflict(CODES.notEligible, 'The candidate already serves this booking.'));
  }
  if (index === NO_UNIT) {
    return err(refusal('not-assigned'));
  }
  return ok({
    ...changeUnit(booking, index, (unit) => ({ ...unit, resourceId })),
    updatedAt: now,
  });
}
