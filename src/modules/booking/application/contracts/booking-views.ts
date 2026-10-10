import type { AvailabilityPlanInput } from '../../domain/models/availability-plan';
import type {
  ChangeActor,
  ChangePolicyInput,
  InformationField,
  ResourceRequirementInput,
} from '../../domain/models/bookable-service';
import type { BookingStatus } from '../../domain/models/booking';

/**
 * Read shapes. Plain and serializable apart from `Date`, which presentation
 * turns into ISO strings. Nothing here exposes a tenant: ownership is an
 * internal detail. Admin views carry the full configuration in the same form
 * the editor submits it, so loading and saving never translate.
 */

export type AvailabilityPlanView = AvailabilityPlanInput;

export interface LocationView {
  readonly id: string;
  readonly websiteId: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  readonly openingHours: AvailabilityPlanView;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ResourceView {
  readonly id: string;
  readonly websiteId: string;
  readonly locationId: string | null;
  readonly name: string;
  readonly type: string;
  readonly skills: readonly string[];
  readonly capacity: number | null;
  readonly availability: AvailabilityPlanView | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ServiceView {
  readonly id: string;
  readonly websiteId: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly isActive: boolean;
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  readonly slotIntervalMinutes: number;
  readonly locationIds: readonly string[];
  readonly requirements: readonly ResourceRequirementInput[];
  readonly participantsPerBooking: number;
  readonly participantsPerSession: number;
  readonly noticeMinutes: number;
  readonly horizonDays: number;
  readonly availability: AvailabilityPlanView | null;
  readonly cancellation: ChangePolicyInput;
  readonly rescheduling: ChangePolicyInput;
  readonly information: ReadonlyArray<{
    readonly field: InformationField;
    readonly isRequired: boolean;
  }>;
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ── Public flow ──────────────────────────────────────────────────────────────

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

/** A reserved slot waiting for the visitor's details. `holdId` is the capability to continue; keep it out of URLs that are shared. */
export interface HoldView {
  readonly holdId: string;
  readonly expiresAt: Date;
  readonly start: Date;
  readonly end: Date;
  readonly participants: number;
  readonly timeZone: string;
  readonly serviceName: string;
  readonly locationName: string;
}

/** The visitor's own booking, as shown on the confirmation and the "my booking" page. */
export interface BookingView {
  readonly reference: string;
  readonly status: BookingStatus;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly locationAddress: string | null;
  readonly timeZone: string;
  readonly start: Date;
  readonly end: Date;
  readonly participants: number;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
  readonly canCancel: boolean;
  readonly canReschedule: boolean;
  readonly rescheduleCount: number;
}

// ── Operations ───────────────────────────────────────────────────────────────

/** One booking on the operations calendar. Staff see more than the visitor: who holds it, and its resources. */
export interface CalendarBookingView {
  readonly id: string;
  readonly reference: string;
  readonly status: BookingStatus;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly locationId: string;
  readonly resourceIds: readonly string[];
  readonly start: Date;
  readonly end: Date;
  readonly occupiedStart: Date;
  readonly occupiedEnd: Date;
  readonly participants: number;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly notes: string | null;
  readonly cancelledBy: ChangeActor | null;
  readonly rescheduleCount: number;
}

export interface CalendarResourceView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly locationId: string | null;
}

export interface OperationsCalendarView {
  readonly timeZone: string;
  readonly from: string;
  readonly to: string;
  readonly bookings: readonly CalendarBookingView[];
  readonly resources: readonly CalendarResourceView[];
}

export interface BookingSetupView {
  readonly locations: readonly LocationView[];
  readonly resources: readonly ResourceView[];
  readonly services: readonly ServiceView[];
}

/** What the signed-in person may do, so the screens offer only actions that will work. The server still checks each one. */
export interface BookingAccessView {
  readonly canConfigure: boolean;
  readonly canManage: boolean;
}
