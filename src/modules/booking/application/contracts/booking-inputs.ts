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
