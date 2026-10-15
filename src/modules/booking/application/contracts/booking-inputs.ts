import type { AvailabilityPlanInput } from '../../domain/models/availability-plan';
import type { BookableResourceInput } from '../../domain/models/bookable-resource';
import type { BookableServiceInput } from '../../domain/models/bookable-service';
import type { BookingLocationInput } from '../../domain/models/booking-location';

/**
 * Request shapes. Ids and instants arrive as text and are parsed by the use
 * case; nothing here is trusted. Dates are `YYYY-MM-DD` days of the
 * location's calendar; instants are ISO-8601 strings with an offset.
 */

export type CreateBookingLocationInput = Omit<BookingLocationInput, 'websiteId'> & {
  readonly websiteId: string;
};
export type UpdateBookingLocationInput = CreateBookingLocationInput & { readonly id: string };

export type CreateBookableResourceInput = Omit<BookableResourceInput, 'websiteId'> & {
  readonly websiteId: string;
};
export type UpdateBookableResourceInput = CreateBookableResourceInput & { readonly id: string };

export type CreateBookableServiceInput = Omit<BookableServiceInput, 'websiteId'> & {
  readonly websiteId: string;
};
export type UpdateBookableServiceInput = CreateBookableServiceInput & { readonly id: string };

/** What the service form asks before saving: could the resources that exist serve this? */
export interface PreviewServiceFeasibilityInput {
  readonly websiteId: string;
  /** The service being edited; absent for a new one. */
  readonly serviceId?: string | undefined;
  readonly locationIds: readonly string[];
  readonly requirements: BookableServiceInput['requirements'];
  readonly participantsPerBooking: number;
  readonly participantsPerSession: number;
}

/** Working hours for employees: one, or many at once for "the same for everyone". */
export interface SetTeamHoursInput {
  readonly resourceIds: readonly string[];
  /** The week to set; `null` returns them to the opening hours of their location. */
  readonly availability: AvailabilityPlanInput | null;
}

/** The hours employees may work at a location, set by a manager. */
export interface SetStaffHoursInput {
  readonly locationId: string;
  /** `null`: whenever the location is open. */
  readonly staffHours: AvailabilityPlanInput | null;
}

/** The services an employee offers, set by a manager. */
export interface SetTeamMemberServicesInput {
  readonly resourceId: string;
  readonly offeredServiceIds: readonly string[];
}

/** Whether a service is offered at one location; the rest of the service is left as it is. */
export interface OfferServiceAtLocationInput {
  readonly serviceId: string;
  readonly locationId: string;
  readonly isOffered: boolean;
}

export interface SearchAddressesInput {
  readonly query: string;
  /** Two-letter language of the suggestions, from the request's locale. */
  readonly language: string;
}

export interface GetBookingCatalogInput {
  readonly websiteId: string;
  /** Narrows the catalog to services of one category key. */
  readonly category?: string | undefined;
  /** Narrows the catalog to specific services (the component's configuration). */
  readonly serviceIds?: readonly string[] | undefined;
}

export interface GetAvailableSlotsInput {
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly from: string;
  readonly to: string;
  readonly participants: number;
}

export interface SuggestAlternativeSlotsInput {
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly start: string;
  readonly participants: number;
  readonly count?: number | undefined;
}

export interface HoldSlotInput {
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly start: string;
  readonly participants: number;
}

export interface ConfirmBookingInput {
  readonly websiteId: string;
  readonly holdId: string;
  /** The form's values by field name; anything the service did not ask for is dropped. */
  readonly customer: Readonly<Record<string, string>>;
}

export interface ReleaseHoldInput {
  readonly websiteId: string;
  readonly holdId: string;
}

/** A visitor finds their booking with the reference they were given AND the e-mail address used. */
export interface BookingAccessInput {
  readonly websiteId: string;
  readonly reference: string;
  readonly email: string;
}

export interface RescheduleOwnBookingInput extends BookingAccessInput {
  readonly start: string;
}

export interface GetOperationsCalendarInput {
  readonly websiteId: string;
  readonly from: string;
  readonly to: string;
  readonly locationId?: string | undefined;
  readonly serviceId?: string | undefined;
  readonly resourceId?: string | undefined;
}

export interface CancelBookingAsStaffInput {
  readonly bookingId: string;
}

export interface RescheduleBookingAsStaffInput {
  readonly bookingId: string;
  readonly start: string;
}

export interface FinishBookingInput {
  readonly bookingId: string;
}

export interface ReleaseExpiredHoldsInput {
  readonly websiteId: string;
}

/** An employee's new working hours for a calendar assigned to them. */
/** An employee's own place in the booking system: hours, where they work, which services they offer. */
export interface SaveOwnProfileInput {
  readonly websiteId: string;
  readonly name: string;
  /** The one location the employee works at. */
  readonly locationId: string;
  readonly offeredServiceIds: readonly string[];
  readonly availability: AvailabilityPlanInput | null;
}
