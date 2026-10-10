import type {
  AvailabilityPlanView,
  BookingSetupView,
  LocationView,
  ResourceView,
  ServiceView,
} from '../../application/contracts/booking-views';

export interface LocationDto {
  readonly id: string;
  readonly websiteId: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  readonly openingHours: AvailabilityPlanView;
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
}

export type ServiceDto = Omit<ServiceView, 'createdAt' | 'updatedAt'>;

export interface BookingSetupDto {
  readonly locations: readonly LocationDto[];
  readonly resources: readonly ResourceDto[];
  readonly services: readonly ServiceDto[];
}

export function toLocationDto(view: LocationView): LocationDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    name: view.name,
    address: view.address,
    timeZone: view.timeZone,
    openingHours: view.openingHours,
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
  };
}

export function toServiceDto(view: ServiceView): ServiceDto {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = view;
  return rest;
}

export function toBookingSetupDto(view: BookingSetupView): BookingSetupDto {
  return {
    locations: view.locations.map(toLocationDto),
    resources: view.resources.map(toResourceDto),
    services: view.services.map(toServiceDto),
  };
}
