import type { BookingCustomer } from '../../domain/models/booking';

/**
 * What a caller sends, as plain values: every id, date and instant is untrusted text until the
 * use case has parsed it. Nothing here names a tenant, a role, a price, a duration or a policy; those
 * come from the server (the signed-in actor, the website's record, the stored service).
 */

/** The days, `YYYY-MM-DD` on the location's calendar, whose start times are asked for. */
export interface GetAvailableSlotsInput {
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly from: string;
  readonly to: string;
}

/** What a public page offers, narrowed by the editor's choice of one service or one category. */
export interface GetBookingCatalogInput {
  readonly websiteId: string;
  readonly serviceId?: string | undefined;
  readonly category?: string | undefined;
}

export interface HoldSlotInput {
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  /** ISO-8601 with its offset: the start the visitor picked from the answer of `GetAvailableSlots`. */
  readonly start: string;
  /** The language the visitor books in (`de`): their messages are written in it. Anything else is ignored. */
  readonly locale?: string | undefined;
}

export interface ConfirmBookingInput {
  readonly websiteId: string;
  readonly bookingId: string;
  readonly customer: BookingCustomer;
}

export interface ReleaseHoldInput {
  readonly websiteId: string;
  readonly bookingId: string;
}

/** A booking reached the way a visitor reaches it: the reference AND the address it was made with. */
export interface PublicBookingKey {
  readonly websiteId: string;
  readonly reference: string;
  readonly email: string;
}

export interface RescheduleOwnBookingInput extends PublicBookingKey {
  readonly start: string;
}

/** The days a visitor looks at to move their own booking, `YYYY-MM-DD` on its location's calendar. */
export interface GetOwnBookingSlotsInput extends PublicBookingKey {
  readonly from: string;
  readonly to: string;
}

/**
 * What a manager's list is narrowed to by state: a status, except that a confirmed booking is told
 * apart by whether an employee still has to take it (BD-04).
 */
export const BOOKING_LIST_STATES = [
  'open',
  'assigned',
  'held',
  'completed',
  'cancelled',
  'no_show',
  'expired',
] as const;
export type BookingListState = (typeof BOOKING_LIST_STATES)[number];

/** The filters a manager's list and calendar share. Days are `YYYY-MM-DD` on the locations' calendar. */
export interface BookingFilterInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  /** The first day; today when absent. */
  readonly from?: string | undefined;
  /** The last day, included; `from` when absent. */
  readonly to?: string | undefined;
  /** Every state when absent. */
  readonly state?: BookingListState | undefined;
  readonly locationId?: string | undefined;
  readonly serviceId?: string | undefined;
  readonly resourceId?: string | undefined;
  readonly customerEmail?: string | undefined;
  /** The code a visitor quotes; any case, surrounding spaces ignored. */
  readonly reference?: string | undefined;
}

/** The manager's list: the days whose bookings start in them, the filters, and the page. */
export interface ListBookingsInput extends BookingFilterInput {
  /** The page asked for, as the address carries it: untrusted, resolved and clamped by the use case. */
  readonly page: { readonly page?: unknown; readonly pageSize?: unknown };
}

/** The calendar: every booking of the days shown (at most 42), with the list's filters. */
export type GetBookingCalendarInput = BookingFilterInput;

/**
 * The free starts of one day for a manager: for a new booking (`serviceId` and `locationId`), or
 * for moving `bookingId` (its own service and location; the booking does not block itself).
 */
export interface GetStaffSlotsInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly day: string;
  readonly bookingId?: string | undefined;
  readonly serviceId?: string | undefined;
  readonly locationId?: string | undefined;
}

/** An employee's own bookings in a span of start times. */
export interface GetMyBookingsInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly from: string;
  readonly to: string;
}

/** A signed-in person's request that names nothing but the website it is for. */
export interface WebsiteTargetInput {
  readonly websiteId: string;
}

export interface BookingTargetInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly bookingId: string;
}

export interface CreateBookingAsStaffInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly start: string;
  readonly customer: BookingCustomer;
  /**
   * Names this attempt. A retry with the same key (after a lost answer, a double click) meets the
   * booking the first try made instead of making another; the key is only ever combined with the
   * signed-in person and their tenant, so nobody can reach another's booking with it.
   */
  readonly requestKey?: string | undefined;
}

export interface RescheduleBookingInput extends BookingTargetInput {
  readonly start: string;
}

export interface AssignEmployeeInput extends BookingTargetInput {
  readonly resourceId: string;
  /** Which requirement of the service the employee fills; the first with an open unit when absent. */
  readonly requirementIndex?: number | undefined;
  /** An employee already on the booking whom this one replaces. */
  readonly replaces?: string | undefined;
}

export interface UnassignEmployeeInput extends BookingTargetInput {
  readonly resourceId: string;
}

export interface GetAssignmentCandidatesInput extends BookingTargetInput {
  /** Which requirement of the service is being filled; the first with an open unit when absent. */
  readonly requirementIndex?: number | undefined;
}
