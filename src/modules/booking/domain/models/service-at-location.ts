import type { BookableService, ServiceRequirement } from './bookable-service';
import type { BookingLocationId } from './ids';
import type { ServiceLocationSetting } from './service-location';

/** The setting of a service at a location, or `null` when it is not switched on there. */
export function settingAt(
  service: BookableService,
  locationId: BookingLocationId,
): ServiceLocationSetting | null {
  return service.locations.find((setting) => setting.locationId === locationId) ?? null;
}

/** A required resource as the requirement the engine reads: this one resource, once. */
function requirementOfResource(
  link: ServiceLocationSetting['resources'][number],
): ServiceRequirement {
  return { resourceType: link.resourceType, skills: [], count: 1, resourceIds: [link.resourceId] };
}

/**
 * The service as it is booked at one location: the shared requirement (the employee and the
 * qualification) first, then the location's required resources in the order they were assigned.
 * Optional resources are left out on purpose: they never decide whether a slot is offered. A
 * location that does not offer the service gets it unchanged, and the policy refuses it there.
 */
export function serviceAtLocation(
  service: BookableService,
  locationId: BookingLocationId,
): BookableService {
  const setting = settingAt(service, locationId);
  if (setting === null) {
    return service;
  }
  const required = setting.resources.filter((link) => link.isRequired);
  return {
    ...service,
    requirements: [...service.requirements, ...required.map(requirementOfResource)],
  };
}
