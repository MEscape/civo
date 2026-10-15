import type {
  AddressSuggestionView,
  AvailabilityPlanView,
  BookingOptionsView,
  OwnProfileView,
  LocationSummaryView,
  LocationView,
  LocationWorkspaceView,
  ResourceView,
  ServiceFeasibilityView,
  ServiceReadiness,
  TeamMemberView,
  TeamView,
  ServiceView,
} from '../../application/contracts/setup-views';

export interface LocationDto {
  readonly id: string;
  readonly websiteId: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  readonly openingHours: AvailabilityPlanView;
  readonly staffHours: AvailabilityPlanView | null;
  readonly isActive: boolean;
}

export interface ResourceDto {
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
  readonly managerChange: ResourceView['managerChange'];
}

export type ServiceDto = Omit<ServiceView, 'createdAt' | 'updatedAt'>;

/** One employee on the team screen. */
export interface TeamMemberDto {
  readonly id: string;
  readonly name: string;
  readonly locationId: string | null;
  readonly availability: AvailabilityPlanView | null;
  readonly isActive: boolean;
  readonly offeredServiceIds: readonly string[];
}

export interface TeamDto {
  readonly members: readonly TeamMemberDto[];
  readonly locations: TeamView['locations'];
  readonly services: TeamView['services'];
}

/** A location on the first screen of the setup. */
export interface LocationSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly isActive: boolean;
  readonly isOpen: boolean;
  readonly serviceCount: number;
  readonly resourceCount: number;
}

/** What the workspace of one location draws from. */
export interface LocationWorkspaceDto {
  readonly location: LocationDto;
  readonly services: ReadonlyArray<{
    readonly service: ServiceDto;
    readonly readiness: ServiceReadiness;
  }>;
  readonly resources: readonly ResourceDto[];
  readonly otherServices: readonly ServiceDto[];
}

/** One address the search suggests. */
export interface AddressSuggestionDto {
  readonly key: string;
  readonly label: string;
}

/** Whether the existing resources can serve a service, location by location. */
export interface ServiceFeasibilityDto {
  readonly locations: ServiceFeasibilityView['locations'];
  readonly canBePublished: boolean;
}

/** The names a screen chooses from (filters, pickers); the configured entries themselves come a page at a time. */
export interface BookingOptionsDto {
  readonly locations: BookingOptionsView['locations'];
  readonly resources: BookingOptionsView['resources'];
  readonly services: BookingOptionsView['services'];
  readonly skills: BookingOptionsView['skills'];
  readonly categories: BookingOptionsView['categories'];
}
export type LocationOption = BookingOptionsView['locations'][number];
export type ResourceOption = BookingOptionsView['resources'][number];

/** What an employee sets up their own calendar from. */
export interface OwnProfileDto {
  readonly profile: ResourceDto | null;
  readonly offeredServiceIds: readonly string[];
  readonly services: OwnProfileView['services'];
  readonly locations: OwnProfileView['locations'];
}

export function toLocationDto(view: LocationView): LocationDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    name: view.name,
    address: view.address,
    timeZone: view.timeZone,
    openingHours: view.openingHours,
    staffHours: view.staffHours,
    isActive: view.isActive,
  };
}

export function toResourceDto(view: ResourceView): ResourceDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    locationId: view.locationId,
    name: view.name,
    type: view.type,
    skills: view.skills,
    capacity: view.capacity,
    availability: view.availability,
    isActive: view.isActive,
    assignedActorId: view.assignedActorId,
    managerChange: view.managerChange,
  };
}

export function toServiceDto(view: ServiceView): ServiceDto {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = view;
  return rest;
}

export function toOwnProfileDto(view: OwnProfileView): OwnProfileDto {
  return {
    profile: view.profile === null ? null : toResourceDto(view.profile),
    offeredServiceIds: view.offeredServiceIds,
    services: view.services,
    locations: view.locations,
  };
}

export function toBookingOptionsDto(view: BookingOptionsView): BookingOptionsDto {
  return {
    locations: view.locations,
    resources: view.resources,
    services: view.services,
    skills: view.skills,
    categories: view.categories,
  };
}

export function toServiceFeasibilityDto(view: ServiceFeasibilityView): ServiceFeasibilityDto {
  return { locations: view.locations, canBePublished: view.canBePublished };
}

export function toAddressSuggestionDto(view: AddressSuggestionView): AddressSuggestionDto {
  return { key: view.key, label: view.label };
}

export function toLocationWorkspaceDto(view: LocationWorkspaceView): LocationWorkspaceDto {
  return {
    location: toLocationDto(view.location),
    services: view.services.map(({ service, readiness }) => ({
      service: toServiceDto(service),
      readiness,
    })),
    resources: view.resources.map(toResourceDto),
    otherServices: view.otherServices.map(toServiceDto),
  };
}

export function toLocationSummaryDto(view: LocationSummaryView): LocationSummaryDto {
  return {
    id: view.id,
    name: view.name,
    address: view.address,
    isActive: view.isActive,
    isOpen: view.isOpen,
    serviceCount: view.serviceCount,
    resourceCount: view.resourceCount,
  };
}

export function toTeamMemberDto(view: TeamMemberView): TeamMemberDto {
  return {
    id: view.id,
    name: view.name,
    locationId: view.locationId,
    availability: view.availability,
    isActive: view.isActive,
    offeredServiceIds: view.offeredServiceIds,
  };
}

export function toTeamDto(view: TeamView): TeamDto {
  return {
    members: view.members.map(toTeamMemberDto),
    locations: view.locations,
    services: view.services,
  };
}
