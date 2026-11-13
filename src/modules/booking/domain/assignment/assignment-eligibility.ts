import type { Brand } from '@lib/utils';

import { isActionAllowed } from '../lifecycle/booking-actions';
import { servesLocation } from '../models/bookable-resource';
import { spanOfRequirement } from '../models/booking';
import { compareIds } from '../models/ids';
import { mergeIntervals, findOverlap, listCovers } from '../time/time-interval';

import type { BookableResource } from '../models/bookable-resource';
import type { ServiceRequirement } from '../models/bookable-service';
import type { Booking } from '../models/booking';
import type { BookableResourceId, BookingId, BookingLocationId } from '../models/ids';
import type { ResourceSchedule } from '../scheduling/scheduling-types';
import type { Instant } from '../time/instant';
import type { TimeInterval } from '../time/time-interval';

/**
 * Why a resource cannot fill a requirement of a booking. All reasons that apply are reported, in
 * this order, so a manager sees everything that is wrong and not only the first thing.
 */
export type IneligibilityReason =
  | { readonly code: 'booking-not-assignable' }
  | { readonly code: 'booking-over' }
  | { readonly code: 'resource-inactive' }
  | { readonly code: 'wrong-resource-type' }
  | { readonly code: 'missing-qualification'; readonly missing: readonly string[] }
  | { readonly code: 'wrong-location' }
  | { readonly code: 'not-in-pinned-pool' }
  | { readonly code: 'already-on-booking' }
  | { readonly code: 'outside-working-hours' }
  | { readonly code: 'time-conflict'; readonly with: TimeInterval };

/**
 * A resource and its calendar. `schedule.busy` must NOT contain this booking itself (a booking
 * never conflicts with its own time), only the other bookings and holds that use the resource.
 */
export interface AssignmentCandidate {
  readonly resource: BookableResource;
  readonly schedule: ResourceSchedule;
}

/**
 * A candidate that passed `assessEligibility` for one requirement of one booking. Only that
 * function makes one, so ranking and assignment cannot be handed a resource nobody checked.
 */
export type EligibleCandidate = Brand<
  AssignmentCandidate & { readonly bookingId: BookingId; readonly requirementIndex: number },
  'EligibleCandidate'
>;

export interface IneligibleCandidate {
  readonly resourceId: BookableResourceId;
  readonly reasons: readonly IneligibilityReason[];
}

export interface EligibilityInput {
  readonly booking: Booking;
  readonly requirement: ServiceRequirement;
  /** The position of `requirement` in the service's requirements. */
  readonly requirementIndex: number;
  readonly candidate: AssignmentCandidate;
  /** The reference instant: a booking that has ended cannot be taken any more. */
  readonly now: Instant;
}

export type EligibilityAssessment =
  | { readonly kind: 'eligible'; readonly candidate: EligibleCandidate }
  | ({ readonly kind: 'ineligible' } & IneligibleCandidate);

/** Whether the resource already serves a DIFFERENT requirement of the booking. */
function servesAnotherRequirement(
  booking: Booking,
  resourceId: BookableResourceId,
  requirementIndex: number,
): boolean {
  return booking.assignments.some(
    (unit) => unit.resourceId === resourceId && unit.requirementIndex !== requirementIndex,
  );
}

/** Why a resource cannot fill a requirement at a location, whatever the time: what it IS, not when it is free. */
function requirementReasons(
  resource: BookableResource,
  requirement: ServiceRequirement,
  locationId: BookingLocationId,
): IneligibilityReason[] {
  const reasons: IneligibilityReason[] = [];
  if (!resource.isActive) {
    reasons.push({ code: 'resource-inactive' });
  }
  if (resource.type !== requirement.resourceType) {
    reasons.push({ code: 'wrong-resource-type' });
  }
  const missing = requirement.skills.filter((skill) => !resource.skills.includes(skill));
  if (missing.length > 0) {
    reasons.push({ code: 'missing-qualification', missing });
  }
  if (!servesLocation(resource, locationId)) {
    reasons.push({ code: 'wrong-location' });
  }
  if (requirement.resourceIds !== null && !requirement.resourceIds.includes(resource.id)) {
    reasons.push({ code: 'not-in-pinned-pool' });
  }
  return reasons;
}

/**
 * Whether a resource can ever fill a requirement at a location: active, of the right type, holding
 * every skill, serving the location, in the pinned pool if there is one. The pool a scheduling
 * question is asked over is made of these; `assessEligibility` applies the same test (and the time
 * checks) to one booking, so the two cannot disagree.
 */
export function canServeRequirement(
  resource: BookableResource,
  requirement: ServiceRequirement,
  locationId: BookingLocationId,
): boolean {
  return requirementReasons(resource, requirement, locationId).length === 0;
}

function reasonsFor(input: EligibilityInput): IneligibilityReason[] {
  const { booking, requirement, requirementIndex, candidate, now } = input;
  const { resource, schedule } = candidate;
  const reasons: IneligibilityReason[] = [];

  if (!isActionAllowed(booking.status, 'assign')) {
    reasons.push({ code: 'booking-not-assignable' });
  }
  if (booking.end <= now) {
    reasons.push({ code: 'booking-over' });
  }
  reasons.push(...requirementReasons(resource, requirement, booking.locationId));
  if (servesAnotherRequirement(booking, resource.id, requirementIndex)) {
    reasons.push({ code: 'already-on-booking' });
  }
  const held = spanOfRequirement(booking, requirementIndex);
  if (!listCovers(mergeIntervals(schedule.availability), held)) {
    reasons.push({ code: 'outside-working-hours' });
  }
  const conflict = findOverlap(mergeIntervals(schedule.busy), held);
  if (conflict !== null) {
    reasons.push({ code: 'time-conflict', with: conflict });
  }
  return reasons;
}

/**
 * The one definition of "this resource can fill this requirement of this booking". Whether the
 * calendar is merely free is not enough: the resource must also be active, of the right type,
 * qualified (hold every skill of the requirement), serve the booking's location, belong to the
 * pinned pool when there is one, work through the whole occupied span and not be taken then.
 *
 * Preferences play no part here. Who is better is `assignment-ranking.ts`, and it only ever sees
 * the candidates this function accepted.
 *
 * Not modelled yet (BD-06, BD-08): whether an employee has chosen to offer the service, and any
 * explicit restriction of a resource to certain services.
 */
export function assessEligibility(input: EligibilityInput): EligibilityAssessment {
  const reasons = reasonsFor(input);
  if (reasons.length > 0) {
    return { kind: 'ineligible', resourceId: input.candidate.resource.id, reasons };
  }
  return {
    kind: 'eligible',
    // Brand constructor: the cast is only permitted here, after every check above passed.
    candidate: {
      ...input.candidate,
      bookingId: input.booking.id,
      requirementIndex: input.requirementIndex,
    } as EligibleCandidate,
  };
}

export interface CandidatePartition {
  readonly eligible: readonly EligibleCandidate[];
  readonly ineligible: readonly IneligibleCandidate[];
}

/** Sorts every candidate into eligible or not, each group by resource id. */
export function assessCandidates(
  input: Omit<EligibilityInput, 'candidate'> & {
    readonly candidates: readonly AssignmentCandidate[];
  },
): CandidatePartition {
  const { candidates, ...rest } = input;
  const eligible: EligibleCandidate[] = [];
  const ineligible: IneligibleCandidate[] = [];
  for (const candidate of candidates) {
    const assessment = assessEligibility({ ...rest, candidate });
    if (assessment.kind === 'eligible') {
      eligible.push(assessment.candidate);
    } else {
      ineligible.push({ resourceId: assessment.resourceId, reasons: assessment.reasons });
    }
  }
  return {
    eligible: eligible.sort((a, b) => compareIds(a.resource.id, b.resource.id)),
    ineligible: ineligible.sort((a, b) => compareIds(a.resourceId, b.resourceId)),
  };
}
