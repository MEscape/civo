import { servesLocation } from '../models/bookable-resource';
import { serviceSkillOf } from '../models/service-skill';

import type { BookableResource } from '../models/bookable-resource';
import type { ResourceRequirement } from '../models/bookable-service';
import type { BookableServiceId, BookingLocationId } from '../models/ids';

/**
 * Whether a resource satisfies a requirement in everything a manager
 * configures: it is active, of the right type, holds every skill, serves the
 * location and is in the pinned pool (when there is one). Whether an
 * employee also offers the service is their own choice and is checked
 * separately by `isEligibleResource`.
 */
export function meetsRequirement(
  resource: BookableResource,
  requirement: ResourceRequirement,
  locationId: BookingLocationId,
): boolean {
  return (
    resource.isActive &&
    resource.type === requirement.resourceType &&
    requirement.skills.every((skill) => resource.skills.includes(skill)) &&
    servesLocation(resource, locationId) &&
    (requirement.resourceIds === null || requirement.resourceIds.includes(resource.id))
  );
}

/**
 * Whether an employee offers the service. Other resource types need no such
 * choice. A service not saved yet (`null`) cannot have been offered by anyone.
 */
export function offersService(
  resource: BookableResource,
  serviceId: BookableServiceId | null,
): boolean {
  return (
    resource.type !== 'employee' ||
    (serviceId !== null && resource.skills.includes(serviceSkillOf(serviceId)))
  );
}

/**
 * The one definition of "this resource can fill this requirement for this
 * service at this location". The slot engine and the configuration preview
 * both ask it, so they cannot disagree.
 */
export function isEligibleResource(
  resource: BookableResource,
  requirement: ResourceRequirement,
  context: { readonly serviceId: BookableServiceId; readonly locationId: BookingLocationId },
): boolean {
  return (
    meetsRequirement(resource, requirement, context.locationId) &&
    offersService(resource, context.serviceId)
  );
}
