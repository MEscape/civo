import type { AvailabilityPlanInput } from '../../domain/models/availability-plan';
import type { ManagerChange } from '../../domain/models/bookable-resource';
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
  /** When employees may work here; `null`: whenever it is open. */
  readonly staffHours: AvailabilityPlanView | null;
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
  readonly assignedActorId: string | null;
  /** What a manager changed on this calendar that the employee has not seen yet. */
  readonly managerChange: ManagerChange | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The names a screen chooses from; see `GetBookingOptions`. */
export interface BookingOptionsView {
  readonly locations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly timeZone: string;
  }>;
  readonly resources: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly locationId: string | null;
    /** What the resource can do, without the services an employee offers. */
    readonly skills: readonly string[];
  }>;
  readonly services: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    /** How far ahead the service can be booked: a move is offered within it. */
    readonly horizonDays: number;
  }>;
  /**
   * The capabilities resources already declare (service skills of employees
   * left out) and the categories services already use: what a form offers
   * to pick from, so a value is chosen rather than retyped.
   */
  readonly skills: readonly string[];
  readonly categories: readonly string[];
}

/** What an employee needs to set up their own calendar: it, and what they can choose from. */
export interface OwnProfileView {
  /** The employee's own resource, or `null` before they first saved it. */
  readonly profile: ResourceView | null;
  readonly offeredServiceIds: readonly string[];
  /** The active services, each with where it is offered: an employee offers only those at their location. */
  readonly services: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly locationIds: readonly string[];
  }>;
  /** The active locations with the week employees may work there, which the employee's own hours stay inside. */
  readonly locations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly timeZone: string;
    readonly employeeHours: AvailabilityPlanView;
  }>;
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

/** One location on the first screen of the setup: what it is and how much is set up there. */
export interface LocationSummaryView {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly isActive: boolean;
  /** Whether it has any opening hours at all: without them nothing there can be booked. */
  readonly isOpen: boolean;
  readonly serviceCount: number;
  /** Rooms and equipment that can serve it, not employees. */
  readonly resourceCount: number;
}

export interface SetupOverviewView {
  readonly locations: readonly LocationSummaryView[];
}

/** Whether a service can be booked at a place: yes, once employees offer it, or not with what exists. */
export type ServiceReadiness = 'ready' | 'awaiting-employees' | 'blocked';

/** Everything the workspace of one location shows. */
export interface LocationWorkspaceView {
  readonly location: LocationView;
  readonly services: ReadonlyArray<{
    readonly service: ServiceView;
    readonly readiness: ServiceReadiness;
  }>;
  /** Rooms and equipment that can serve this location (its own, and those that serve every location). */
  readonly resources: readonly ResourceView[];
  /** Services of the website that are not offered here yet, whole, so adding one can check it against this location. */
  readonly otherServices: readonly ServiceView[];
}

/** One employee's calendar as the team screen shows it. */
export interface TeamMemberView {
  readonly id: string;
  readonly name: string;
  /** Where they work; `null` for every location. */
  readonly locationId: string | null;
  /** Their own week; `null` follows the opening hours of the location. */
  readonly availability: AvailabilityPlanView | null;
  readonly isActive: boolean;
  /** The services they offer, by id. */
  readonly offeredServiceIds: readonly string[];
}

export interface TeamView {
  readonly members: readonly TeamMemberView[];
  /** The places they can work at, with the week each is open: the frame of an employee's own hours. */
  readonly locations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly openingHours: AvailabilityPlanView;
    /** The hours set for employees there, as stored; `null` whenever it is open. */
    readonly staffHours: AvailabilityPlanView | null;
    /** What employees may actually work: the hours set for them cut to the opening hours. The frame of their own hours. */
    readonly employeeHours: AvailabilityPlanView;
  }>;
  /** The active services with where each is offered: a manager puts an employee only on those at their location. */
  readonly services: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly locationIds: readonly string[];
  }>;
}

/** Someone a calendar can be assigned to, as the screens offer them. */
export interface EmployeeOptionView {
  readonly id: string;
  readonly name: string;
}

/** What the signed-in person may do, so the screens offer only actions that will work. The server still checks each one. */
export interface BookingAccessView {
  readonly canConfigure: boolean;
  readonly canManage: boolean;
  /** Sees only the bookings and calendars assigned to them (the employee role). */
  readonly isOwnOnly: boolean;
}

/** One address the search suggests. */
export interface AddressSuggestionView {
  /** Stable for the same place, so a list can key on it. */
  readonly key: string;
  /** What is stored and shown: a full postal line. */
  readonly label: string;
}

/** One requirement of a service at one location: what is needed and what qualifies. */
export interface RequirementCoverageView {
  readonly requirementIndex: number;
  readonly resourceType: string;
  readonly needed: number;
  readonly eligibleCount: number;
  readonly eligible: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  /** How many candidates remain after each condition, so a failure can name the one that removed the last. */
  readonly funnel: {
    readonly ofType: number;
    readonly withSkills: number;
    readonly atLocation: number;
    readonly inPool: number;
  };
  /** Employees who would fit but have not offered the service yet. */
  readonly awaitingEmployees: number;
}

export interface LocationFeasibilityView {
  readonly locationId: string;
  readonly locationName: string;
  readonly readiness: 'ready' | 'awaiting-employees' | 'blocked';
  readonly block: 'not-enough-resources' | 'shared-resources' | null;
  readonly blockedRequirementIndex: number | null;
  readonly coverage: readonly RequirementCoverageView[];
  readonly largestGroup: number;
}

/** Whether the configured resources can serve a service, location by location. */
export interface ServiceFeasibilityView {
  readonly locations: readonly LocationFeasibilityView[];
  readonly canBePublished: boolean;
}
