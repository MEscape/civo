import type { InformationField } from '../../domain/models/bookable-service';

/** What a visitor sees while choosing: services, places and free times. */

/** A place a visitor can choose. */
export interface PublicLocationView {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
}

/**
 * What a visitor needs to choose and book a service. The booking flow adapts
 * to it: one location means no location step, a group size of one means no
 * participants step, and no required documents means no checklist.
 */
export interface PublicServiceView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly durationMinutes: number;
  readonly locations: readonly PublicLocationView[];
  readonly maxParticipantsPerBooking: number;
  readonly information: ReadonlyArray<{
    readonly field: InformationField;
    readonly isRequired: boolean;
  }>;
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
  /** The furthest ahead a booking can be made, in days. */
  readonly horizonDays: number;
  readonly cancellationAllowed: boolean;
  readonly cancellationDeadlineMinutes: number;
}

export interface PublicCatalogView {
  readonly services: readonly PublicServiceView[];
}

/** One bookable start time. It names no resource: who serves the appointment is not the visitor's concern. */
export interface SlotView {
  readonly start: Date;
  readonly end: Date;
  /** Places left at this time; 1 for a service that holds its resources alone. */
  readonly remainingParticipants: number;
}

export interface AvailabilityView {
  readonly serviceId: string;
  readonly locationId: string;
  /** The zone slot times must be shown in: the location's, whatever zone the visitor is in. */
  readonly timeZone: string;
  readonly from: string;
  readonly to: string;
  readonly slots: readonly SlotView[];
}

export interface AlternativeSlotsView {
  readonly timeZone: string;
  readonly slots: readonly SlotView[];
}
