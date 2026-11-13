import { compareIds } from '../models/ids';

import { FIT_LEVELS, assessFit } from './assignment-fit';

import type { EligibleCandidate } from './assignment-eligibility';
import type { Fit, FitSubject } from './assignment-fit';
import type { Booking } from '../models/booking';
import type { EmployeePreferences } from '../models/employee-preferences';
import type { BookableResourceId } from '../models/ids';
import type { TimeZone } from '../time/time-zone';

function comparison(a: number, b: number): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/**
 * Orders two fits, best first: the level, then a preferred service, then a time in the window. Equal
 * fits compare as equal; the callers break the tie with something that is never equal.
 */
export function compareFit(a: Fit, b: Fit): number {
  return (
    comparison(FIT_LEVELS.indexOf(a.level), FIT_LEVELS.indexOf(b.level)) ||
    comparison(Number(b.isServicePreferred), Number(a.isServicePreferred)) ||
    comparison(Number(b.isTimeInWindow), Number(a.isTimeInWindow))
  );
}

export interface RankedCandidate {
  readonly candidate: EligibleCandidate;
  readonly fit: Fit;
}

export interface RankCandidatesInput {
  /** Only candidates that passed `assessEligibility`: the type does not admit any other. */
  readonly candidates: readonly EligibleCandidate[];
  /** An employee who set none is absent from the map and counts as having no preference. */
  readonly preferences: ReadonlyMap<BookableResourceId, EmployeePreferences>;
  readonly subject: FitSubject;
}

/**
 * The eligible candidates for one booking, best fit first. Ties are broken by resource id (code-unit
 * order), so the same input always gives the same list. Ranking only orders: it never adds or removes
 * a candidate, and no score can make an ineligible resource eligible, because it never sees one.
 * What it does NOT measure: workload, fairness or manager preference; no such input exists yet.
 */
export function rankCandidates(input: RankCandidatesInput): RankedCandidate[] {
  return input.candidates
    .map((candidate) => ({
      candidate,
      fit: assessFit(input.preferences.get(candidate.resource.id) ?? null, input.subject),
    }))
    .sort(
      (a, b) =>
        compareFit(a.fit, b.fit) || compareIds(a.candidate.resource.id, b.candidate.resource.id),
    );
}

export interface OpenBooking {
  readonly booking: Booking;
  /** The zone of the booking's location. */
  readonly zone: TimeZone;
}

export interface RankedBooking {
  readonly booking: Booking;
  readonly fit: Fit;
}

export interface RankBookingsInput {
  /** Bookings the employee is eligible for; ranking does not check that. */
  readonly bookings: readonly OpenBooking[];
  readonly preferences: EmployeePreferences | null;
}

/**
 * The bookings on offer to one employee, best fit first, then earliest start, then booking id. The
 * employee may take any of them: the fit is only the order of the list.
 */
export function rankBookings(input: RankBookingsInput): RankedBooking[] {
  return input.bookings
    .map(({ booking, zone }) => ({
      booking,
      fit: assessFit(input.preferences, {
        serviceId: booking.serviceId,
        appointment: { start: booking.start, end: booking.end },
        zone,
      }),
    }))
    .sort(
      (a, b) =>
        compareFit(a.fit, b.fit) ||
        comparison(a.booking.start, b.booking.start) ||
        compareIds(a.booking.id, b.booking.id),
    );
}
