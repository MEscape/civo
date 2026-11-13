import type { InformationField } from '../../domain/models/bookable-service';

/**
 * What a visitor may book on a website: the services that take online bookings and the places
 * that offer them. No resource, employee or internal note is part of it.
 */

/** What a visitor is told of the service's rules for cancelling or moving a booking. */
export interface CatalogChangeRuleView {
  /** Visitors may do it themselves. */
  readonly isAllowed: boolean;
  /** Until this many minutes before the start. */
  readonly deadlineMinutes: number;
}

export interface CatalogServiceView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly instructions: string | null;
  readonly requiredDocuments: readonly string[];
  readonly durationMinutes: number;
  /** How many days ahead it can be booked. */
  readonly horizonDays: number;
  /** What the booking form asks for, in the service's order. */
  readonly information: ReadonlyArray<{
    readonly field: InformationField;
    readonly isRequired: boolean;
  }>;
  readonly cancellation: CatalogChangeRuleView;
  readonly rescheduling: CatalogChangeRuleView;
  /** Where it can be booked online, in the order of `locations`. */
  readonly locationIds: readonly string[];
}

export interface CatalogLocationView {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  /** The calendar day it is there now, `YYYY-MM-DD`: where a visitor's calendar starts. */
  readonly today: string;
}

export interface BookingCatalogView {
  readonly services: readonly CatalogServiceView[];
  /** Only the locations at which some service of `services` can be booked. */
  readonly locations: readonly CatalogLocationView[];
  /** The website offers more services or locations than one answer carries. */
  readonly isTruncated: boolean;
}
