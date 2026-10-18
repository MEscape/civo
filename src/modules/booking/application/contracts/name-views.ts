/** A thing of the bookings named by id, for a screen that keeps only ids (the audit log). */
export interface BookingNameView {
  readonly id: string;
  readonly name: string;
}

/** The ids to name, per kind. Untrusted: each is parsed, and malformed ones are dropped. */
export interface ResolveBookingNamesInput {
  readonly serviceIds: readonly string[];
  readonly locationIds: readonly string[];
  readonly resourceIds: readonly string[];
  readonly bookingIds: readonly string[];
}

/**
 * The names asked for, per kind; an id that names nothing of the website is
 * absent. A booking is named by its reference, never by the person who booked.
 */
export interface BookingNamesView {
  readonly services: readonly BookingNameView[];
  readonly locations: readonly BookingNameView[];
  readonly resources: readonly BookingNameView[];
  readonly bookings: readonly BookingNameView[];
}
