import type { OpeningHoursInput } from './location-inputs';

/**
 * What a caller sends to look after employees' calendars, as plain values. Hours use the shape of a
 * location's (`HH:mm` on the location's wall clock), and the exceptions are absences: closed day
 * ranges (`YYYY-MM-DD`, both ends included). All of it is untrusted until the use case has read it;
 * nothing names a tenant or a website, and the employee's own screens name no calendar at all (it is
 * found by the person signed in).
 */
export interface EmployeeCalendarInput {
  /** Seven days, Monday first; the exceptions are absences. */
  readonly openingHours: OpeningHoursInput;
}

/** A manager sends an employee to another location for some days (`YYYY-MM-DD`, both ends included). */
export interface CoverageInput {
  readonly locationId: string;
  readonly from: string;
  readonly to: string;
}

export interface GetTeamInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
}

export interface GetTeamMemberInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly employeeId: string;
}

/** A manager gives a member who holds the role `employee` their calendar at a location. */
export interface SetUpTeamMemberInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly actorId: string;
  readonly locationId: string;
}

export interface UpdateTeamMemberInput extends EmployeeCalendarInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly employeeId: string;
  /** The `version` of the view the form was filled from. */
  readonly expectedVersion: string;
  /** Granted by managers only (BD-06). */
  readonly qualifications: readonly string[];
  /** Where the employee works at other locations, and when; set by managers only. */
  readonly coverage: readonly CoverageInput[];
  /** The manager has seen the bookings the change leaves without the employee and lets them stand. */
  readonly acknowledgeImpact: boolean;
}

export interface PreviewTeamMemberChangeInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly employeeId: string;
  readonly calendar: EmployeeCalendarInput;
  /** The cover as the form has it now; absent: as it is stored. */
  readonly coverage?: readonly CoverageInput[] | undefined;
}

/** A manager takes a member out of their team: the bookings that have not begun are open again. */
export interface RemoveTeamMemberInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly employeeId: string;
  /** The `version` of the calendar the manager looked at. */
  readonly expectedVersion: string;
  /** The manager has seen the bookings that become open and lets it happen. */
  readonly acknowledgeImpact: boolean;
}

/** A manager moves a member to the team of another location: the same, and a new calendar there. */
export interface MoveTeamMemberInput extends RemoveTeamMemberInput {
  /** The location whose team the member joins. */
  readonly locationId: string;
}

export interface PreviewTeamMemberRemovalInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly employeeId: string;
}

/** The employee changes their own hours and absences; never their qualifications or location. */
export interface SaveOwnProfileInput extends EmployeeCalendarInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly expectedVersion: string;
  readonly acknowledgeImpact: boolean;
}

export interface PreviewOwnProfileChangeInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly calendar: EmployeeCalendarInput;
}
