import type { ExceptionKind } from '../../domain/scheduling/availability-plan';

/**
 * What a caller sends to create or change a location, as plain values: times are `HH:mm` text on
 * the location's wall clock (`24:00` only as an end), days are `YYYY-MM-DD` on its calendar, the zone
 * is an IANA name. All of it is untrusted until `parseLocationInput` has read it; nothing names a
 * tenant, a website or a person.
 */
export interface RangeInput {
  readonly start: string;
  readonly end: string;
}

/** One day: when the place is open, and the breaks inside it. */
export interface DayInput {
  readonly intervals: readonly RangeInput[];
  readonly breaks: readonly RangeInput[];
}

/** A dated change to the week: a closure, other hours that day, or extra hours on top. */
export interface ExceptionInput {
  readonly kind: ExceptionKind;
  readonly from: string;
  /** Last day covered, included. */
  readonly to: string;
  /** The hours of a non-closing exception; ignored for a closure. */
  readonly day?: DayInput | undefined;
}

export interface OpeningHoursInput {
  /** Seven days, Monday first. */
  readonly weekly: readonly DayInput[];
  readonly exceptions: readonly ExceptionInput[];
}

export interface LocationInput {
  readonly name: string;
  readonly address: string;
  readonly timeZone: string;
  readonly isActive: boolean;
  readonly openingHours: OpeningHoursInput;
}

/** A new location: its definition, for the website named. */
export interface CreateLocationInput extends LocationInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
}

export interface GetLocationInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
}

export interface UpdateLocationInput extends LocationInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  /** The `version` of the `LocationView` the form was filled from. */
  readonly expectedVersion: string;
  /**
   * The manager has seen the bookings this change leaves outside the new hours and lets them stand.
   * Nothing is cancelled or moved either way; without it, a change that affects bookings is refused.
   */
  readonly acknowledgeImpact: boolean;
}

/** The location as it would become, to ask which existing bookings the change would affect. */
export interface PreviewLocationChangeInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  readonly location: LocationInput;
}

export interface ListLocationsInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly search?: string | undefined;
  readonly isActive?: boolean | undefined;
  /** The page asked for, as the address carries it: untrusted, resolved and clamped by the use case. */
  readonly page: { readonly page?: unknown; readonly pageSize?: unknown };
}
