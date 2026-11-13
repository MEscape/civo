import type { DayInput } from './location-inputs';
import type { ResourceBlockView } from './resource-views';
import type { LocationNameView } from './service-views';

/**
 * What the team screens are answered with: names (never e-mail addresses), hours as `HH:mm` text,
 * days as `YYYY-MM-DD`, instants as ISO-8601 text on the location's wall clock with their offset.
 */

/** Days an employee works at another location: where, from and to (`YYYY-MM-DD`, both included). */
export interface CoverageView {
  readonly locationId: string;
  readonly locationName: string;
  readonly from: string;
  readonly to: string;
}

/** An employee in the team list. */
export interface TeamMemberSummaryView {
  readonly id: string;
  readonly name: string;
  /** Seven days, Monday first: their own week, or the location's when they keep its hours. */
  readonly weekly: readonly DayInput[];
  readonly absences: readonly ResourceBlockView[];
  /** Where a manager sends them to work for some days. */
  readonly coverage: readonly CoverageView[];
  readonly qualifications: readonly string[];
  /** The calendar's version: what a change of it (moving, removing) must name. */
  readonly version: string;
}

/** A member with the role `employee` who has no calendar yet. */
export interface TeamCandidateView {
  readonly actorId: string;
  readonly name: string;
}

/** A member taken out of a team: whose calendar, and how many bookings are open again. */
export interface TeamLeftView {
  readonly websiteId: string;
  readonly employeeId: string;
  readonly releasedBookings: number;
}

/** An employee of another location who works here for some days. */
export interface TeamVisitorView {
  readonly id: string;
  readonly name: string;
  /** Where their calendar belongs, and where a manager changes it. */
  readonly home: LocationNameView;
  readonly from: string;
  readonly to: string;
}

export interface TeamView {
  readonly location: LocationNameView;
  readonly members: readonly TeamMemberSummaryView[];
  /** The other locations a member can be moved to. */
  readonly moveTargets: readonly LocationNameView[];
  /** Employees of other locations who are sent here, one entry per spell. */
  readonly visitors: readonly TeamVisitorView[];
  readonly candidates: readonly TeamCandidateView[];
  /** The website has more employees than the directory names; the candidates are the first ones. */
  readonly isTruncated: boolean;
}

/** One calendar in the shape its form edits, and the version a change must name. */
export interface TeamMemberView extends TeamMemberSummaryView {
  readonly websiteId: string;
  readonly location: LocationNameView;
  /** The other locations a manager can send the employee to. */
  readonly coverageChoices: readonly LocationNameView[];
  /** The location's week: the employee's hours must lie inside it. */
  readonly locationWeekly: readonly DayInput[];
  /** Qualifications held in the team, to choose from; empty on the employee's own screen. */
  readonly knownQualifications: readonly string[];
}

/** The signed-in employee's own calendar, with what day it is for them (on the clock of their location). */
export interface OwnProfileView extends TeamMemberView {
  readonly today: string;
}
