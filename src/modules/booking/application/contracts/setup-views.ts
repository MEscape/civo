import type { AvailabilityPlanInput } from '../../domain/models/availability-plan';
import type {
  ChangePolicyInput,
  InformationField,
  ResourceRequirementInput,
} from '../../domain/models/bookable-service';

/**
 * Configuration read shapes for the administration screens. They carry the full
 * configuration in the same form the editor submits it, so loading and saving
 * never translate. Nothing here exposes a tenant: ownership is an internal detail.
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
