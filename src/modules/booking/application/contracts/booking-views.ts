import type { BookingListState } from './booking-inputs';
import type { IneligibilityReason } from '../../domain/assignment/assignment-eligibility';
import type { Fit } from '../../domain/assignment/assignment-fit';
import type { AssignmentState } from '../../domain/assignment/booking-assignment';
import type { ResourceKind } from '../../domain/models/bookable-resource';
import type { BookingCustomer, BookingStatus } from '../../domain/models/booking';
import type { SlotEmptiness } from '../services/slot-emptiness';

/**
 * What the application answers with. Instants are ISO-8601 text on the wall clock of the booking's
 * location, with their offset, and the location's zone is named beside them, so a screen can show
 * the time the people there see and still know the moment. Ids are the module's own; no persistence
 * type, no internal field, and no localized text.
 */

export interface SlotView {
  readonly start: string;
  readonly end: string;
}

export interface AvailableSlotsView {
  readonly timeZone: string;
  readonly slots: readonly SlotView[];
  /** True when more starts exist than one answer carries; ask for a shorter span. */
  readonly isTruncated: boolean;
  /** A manager's question only: why the day has no start, when it has none. */
  readonly emptiness?: SlotEmptiness;
}

export interface UnitView {
  readonly requirementIndex: number;
  readonly resourceType: ResourceKind;
  /** `null`: an employee unit nobody serves yet. */
  readonly resourceId: string | null;
}

/** What a manager sees of a booking, the customer included. */
export interface BookingView {
  readonly websiteId: string;
  readonly id: string;
  readonly reference: string;
  readonly status: BookingStatus;
  readonly serviceId: string;
  readonly locationId: string;
  readonly timeZone: string;
  readonly start: string;
  readonly end: string;
  readonly units: readonly UnitView[];
  /** `open`: some employee unit waits; `assigned`: none does. */
  readonly assignment: Exclude<AssignmentState, 'conflict'>;
  readonly customer: BookingCustomer | null;
  readonly holdExpiresAt: string | null;
  readonly rescheduleCount: number;
  readonly cancelledAt: string | null;
  readonly createdAt: string;
}

/** A booking as its detail panel shows it, with what a manager may still change about who serves it. */
export interface BookingDetailView extends BookingView {
  /** `mayReplace`: an employee can be swapped for another; `mayRemove`: taken off, the place left open. */
  readonly staffChanges: { readonly mayReplace: boolean; readonly mayRemove: boolean };
}

/** What an employee sees of a booking: the same facts without the customer (what they may see of one is open, P15). */
export type EmployeeBookingView = Omit<BookingView, 'customer'>;

/** Whether a visitor may cancel or move their own booking, as the service's policy says. */
export interface OwnChangeView {
  /** They may do it now (the booking is confirmed, the deadline not passed, the limit not reached). */
  readonly isAllowed: boolean;
  /** The last moment they may, on the location's wall clock; `null` when the service never lets them. */
  readonly until: string | null;
}

/** What a visitor sees of their own booking. */
export interface PublicBookingView {
  readonly websiteId: string;
  readonly id: string;
  readonly reference: string;
  readonly status: BookingStatus;
  readonly serviceId: string;
  /** The service as it was booked. */
  readonly serviceName: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly locationAddress: string | null;
  readonly timeZone: string;
  readonly start: string;
  readonly end: string;
  readonly holdExpiresAt: string | null;
  readonly rescheduleCount: number;
  readonly cancellation: OwnChangeView;
  readonly rescheduling: OwnChangeView;
}

/** How many bookings of the list's days and filters are in each state, and all of them, whatever state is chosen. */
export type BookingStateCountsView = Readonly<Record<BookingListState | 'all', number>>;

/** The days a list or calendar covers, `YYYY-MM-DD`, both included: what "today" was taken to be. */
export interface BookingDaysView {
  readonly from: string;
  readonly to: string;
}

export interface BookingPageView {
  readonly items: readonly BookingView[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly pageCount: number;
  readonly days: BookingDaysView;
  readonly counts: BookingStateCountsView;
}

/** Every booking of the days a calendar shows, earliest first; `isTruncated` when there were more than one answer carries. */
export interface BookingCalendarView {
  readonly days: BookingDaysView;
  readonly items: readonly BookingView[];
  readonly isTruncated: boolean;
  readonly counts: BookingStateCountsView;
}

/**
 * What the website's services, locations and resources (employees included) are called, by id: the
 * one read that labels a manager's list, panel and calendar, and fills their filters. Names are
 * tenant data: they go into views, never into logs.
 */
export interface BookingNamesView {
  readonly locations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly timeZone: string;
    /** Today on the location's calendar, `YYYY-MM-DD`: where a calendar or a day picker starts. */
    readonly today: string;
  }>;
  readonly services: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  /** The website has more services than the answer names. */
  readonly isServicesTruncated: boolean;
  readonly resources: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly type: ResourceKind;
  }>;
}

export interface FitView {
  readonly level: Fit['level'];
  /** Why, as stable codes. */
  readonly reasons: Fit['reasons'];
}

/**
 * What a booking is called where an employee sees it. Names are tenant data: they go into views,
 * never into logs. `null`: the service or location is gone. Only rooms, desks and devices are named,
 * never a person.
 */
export interface BookingLabelsView {
  readonly serviceName: string | null;
  readonly locationName: string | null;
  readonly resourceNames: readonly string[];
}

/** A booking on offer to an employee, with how well it fits them. No customer data. */
export interface OpenBookingView {
  readonly booking: EmployeeBookingView;
  readonly fit: FitView;
  readonly labels: BookingLabelsView;
}

export interface CandidateView {
  readonly resourceId: string;
  readonly fit: FitView;
}

export interface UnavailableCandidateView {
  readonly resourceId: string;
  /** Every reason that applies, as stable codes. */
  readonly reasons: readonly IneligibilityReason[];
}

/** Who can fill a requirement of a booking, best fit first, and who cannot and why. */
export interface AssignmentCandidatesView {
  readonly requirementIndex: number;
  readonly eligible: readonly CandidateView[];
  readonly unavailable: readonly UnavailableCandidateView[];
}
