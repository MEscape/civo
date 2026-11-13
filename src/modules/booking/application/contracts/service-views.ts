import type { DeactivationScope, EmployeeNeed } from './booking-constraints';
import type { ResourceKind } from '../../domain/models/bookable-resource';
import type { ChangeActor } from '../../domain/models/bookable-service';

/**
 * What the administration of services is answered with: ids, ISO text with the location's offset,
 * closed vocabularies and codes, never a persistence type or localized text. `internalNote` is here
 * because these are the manager's views; no visitor's view carries it.
 */
export interface LocationNameView {
  readonly id: string;
  readonly name: string;
}

/** How a service came to be at a location. */
export type ServiceOriginView =
  | { readonly kind: 'own' }
  | { readonly kind: 'copy'; readonly from: LocationNameView | null }
  | { readonly kind: 'linked'; readonly from: LocationNameView | null };

export interface ServiceSummaryView {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly durationMinutes: number;
  /** Switched on as a whole and at this location. */
  readonly isActive: boolean;
  readonly isOnlineBookable: boolean;
  readonly origin: ServiceOriginView;
}

/** The services of one category. */
export interface ServiceGroupView {
  /** `null`: not in a category. */
  readonly category: string | null;
  readonly items: readonly ServiceSummaryView[];
}

/** A page of categories with their services (a page is a few whole categories, never half of one). */
export interface ServicePageView {
  readonly location: LocationNameView;
  readonly groups: readonly ServiceGroupView[];
  readonly page: number;
  readonly pageSize: number;
  /** Categories under the filters. */
  readonly total: number;
  readonly pageCount: number;
  /** Services under the filters, all categories. */
  readonly serviceCount: number;
  /** Every category the location uses, for the filter. */
  readonly categories: readonly string[];
  /** More services exist than one answer carries. */
  readonly isTruncated: boolean;
}

export interface AdoptableServiceView {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly durationMinutes: number;
  readonly source: LocationNameView | null;
}

/** The services a location that is not made yet could start with: every service on anywhere, each once. */
export interface OfferableServicesView {
  readonly items: readonly AdoptableServiceView[];
  /** There are more services than one answer reads; the list is partial. */
  readonly isTruncated: boolean;
}

export interface AdoptablePageView {
  readonly location: LocationNameView;
  readonly items: readonly AdoptableServiceView[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly pageCount: number;
  /** The other locations that have services, for the source filter. */
  readonly sources: readonly LocationNameView[];
  readonly isTruncated: boolean;
}

/** A resource as a form offers it to choose from. */
export interface ResourceOptionView {
  readonly id: string;
  readonly name: string;
  readonly type: ResourceKind;
  readonly capacity: number | null;
  readonly isActive: boolean;
  readonly setupMinutes: number;
  readonly teardownMinutes: number;
  /** How many services use it somewhere. */
  readonly usedByServices: number;
}

/** A resource a service uses, with what a person needs to recognise it. */
export interface ServiceResourceView extends ResourceOptionView {
  readonly isRequired: boolean;
}

export interface ServiceFormOptionsView {
  readonly categories: readonly string[];
  readonly qualifications: readonly string[];
  /** The resources that can serve this location. */
  readonly resources: readonly ResourceOptionView[];
  /** The website has more categories or resource uses than one answer reads; the lists are partial. */
  readonly isTruncated: boolean;
}

/** A service at one location, in the shape its forms edit. */
export interface ServiceView {
  readonly websiteId: string;
  readonly id: string;
  readonly location: LocationNameView;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly documents: readonly string[];
  readonly instructions: string;
  readonly internalNote: string;
  /** Switched on at this location. */
  readonly isActive: boolean;
  /** Switched on as a whole (the shared definition); a service off as a whole is off everywhere. */
  readonly isServiceActive: boolean;
  readonly isOnlineBookable: boolean;
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  readonly resources: readonly ServiceResourceView[];
  readonly noticeMinutes: number;
  readonly horizonDays: number;
  readonly cancelUntilMinutes: number;
  readonly changeUntilMinutes: number;
  readonly actors: readonly ChangeActor[];
  readonly employee: EmployeeNeed;
  readonly qualification: string;
  readonly origin: ServiceOriginView;
  /** The other locations that have the service on: a change to the shared definition reaches them. */
  readonly sharedWith: readonly LocationNameView[];
  /** Names the shared definition the form was filled from; a change is refused if it moved on. */
  readonly version: string;
  /** Names this location's part the same way. */
  readonly settingVersion: string;
  /** Confirmed bookings of the service at this location that have not started yet. */
  readonly futureBookingCount: number;
  /** The same across every location that has it. */
  readonly futureBookingCountAll: number;
}

/** A booking a closing service reaches. */
export interface ServiceBookingView {
  readonly bookingId: string;
  readonly locationId: string;
  readonly timeZone: string;
  readonly start: string;
  readonly end: string;
}

/** What closing a service would reach, before anything is changed. */
export interface DeactivationImpactView {
  readonly scope: DeactivationScope;
  /** How many locations have the service on: the ones a closing for `all` reaches. */
  readonly locationCount: number;
  /** Confirmed bookings ahead in the scope. */
  readonly futureBookingCount: number;
  readonly bookings: readonly ServiceBookingView[];
  readonly isTruncated: boolean;
}

/** A service an editor can narrow the booking component to. */
export interface BookingChoiceView {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
}

/** What the page editor offers for the booking component: the website's running services and their categories. */
export interface BookingChoicesView {
  readonly services: readonly BookingChoiceView[];
  readonly categories: readonly string[];
}

/** One location a person can start the next step at. */
export interface SetupLocationView {
  readonly id: string;
  readonly name: string;
}

/**
 * How far the website's booking setup has come: a location first, then the services it offers, the
 * resources they use and the team that serves them. Counts are what one bounded read names, so
 * `isTruncated` says a count is "at least".
 */
export interface BookingSetupView {
  readonly locations: number;
  readonly services: number;
  /** Rooms, desks and devices: every resource that is not an employee. */
  readonly resources: number;
  /** Employees with a calendar. */
  readonly team: number;
  /** The locations to start the next step at, by name. */
  readonly locationChoices: readonly SetupLocationView[];
  readonly isTruncated: boolean;
}
