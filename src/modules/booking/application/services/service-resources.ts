import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import {
  BOOKING_VALIDATION_CODES as CODES,
  createBookingErrorBag,
} from '../../domain/errors/booking-errors';
import { servesLocation } from '../../domain/models/bookable-resource';
import { toBookableResourceId } from '../../domain/models/ids';
import { MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';

import type { ParsedLocalPart } from './parse-service-input';
import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookingLocationId } from '../../domain/models/ids';
import type { ServiceResourceLink } from '../../domain/models/service-location';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { ResourceOptionView, ServiceResourceView } from '../contracts/service-views';

/** The self-declared `svc-<id>` skill of the first version is a preference, not a qualification (BD-06). */
const LEGACY_OFFER_PREFIX = 'svc-';

/** Whether a skill an employee holds is a qualification (and not a first-version service offer). */
export const isQualification = (skill: string): boolean => !skill.startsWith(LEGACY_OFFER_PREFIX);

/** The resources of the website that can serve a location, active or not, in id order. */
export function loadResourcesServing(
  deps: Pick<ServiceAdminDependencies, 'resources'>,
  scope: BookingScope,
  locationId: BookingLocationId,
): AppResultAsync<readonly BookableResource[], InfrastructureAppError> {
  return deps.resources
    .list(scope, { limit: MAX_RESOURCES_PER_WEBSITE })
    .map((all) => all.filter((resource) => servesLocation(resource, locationId)));
}

/** The qualifications employees hold: each once, in name order. */
export function qualificationsOf(resources: readonly BookableResource[]): string[] {
  return unique(
    resources
      .filter((resource) => resource.type === 'employee')
      .flatMap((resource) => resource.skills)
      .filter(isQualification),
  ).sort((a, b) => a.localeCompare(b));
}

/** A resource as a form offers it: what it is, and how many services already use it. */
export function toResourceOption(
  resource: BookableResource,
  use: ReadonlyMap<string, number>,
): ResourceOptionView {
  return {
    id: resource.id,
    name: resource.name,
    type: resource.type,
    capacity: resource.capacity,
    isActive: resource.isActive,
    setupMinutes: resource.setupMinutes,
    teardownMinutes: resource.teardownMinutes,
    usedByServices: use.get(resource.id) ?? 0,
  };
}

/** The resources a service uses at a location, each with its name and whether it is needed. */
export function toServiceResources(
  links: readonly ServiceResourceLink[],
  resources: readonly BookableResource[],
  use: ReadonlyMap<string, number>,
): ServiceResourceView[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  return links.flatMap((link) => {
    const resource = byId.get(link.resourceId);
    return resource === undefined
      ? []
      : [{ ...toResourceOption(resource, use), isRequired: link.isRequired }];
  });
}

/**
 * The links a form names, checked against what can serve the location: each must be a resource
 * of this website that serves the location and is not an employee (the employee is the
 * qualification). Every one that is not is reported at its own row.
 */
export function linksFor(
  wanted: ParsedLocalPart['resources'],
  serving: readonly BookableResource[],
): AppResult<ServiceResourceLink[], ValidationAppError> {
  const byId = new Map(serving.map((resource) => [resource.id, resource]));
  const bag = createBookingErrorBag();
  const links: ServiceResourceLink[] = [];
  wanted.forEach(({ resourceId, isRequired }, index) => {
    const resource = byId.get(toBookableResourceId(resourceId));
    const isChoosable = resource !== undefined && resource.type !== 'employee';
    bag.expect(isChoosable, `resources.${index}.resourceId`, CODES.resourceInvalid);
    if (isChoosable) {
      links.push({ resourceId: resource.id, resourceType: resource.type, isRequired });
    }
  });
  return bag.hasErrors ? err(bag.toError()) : ok(links);
}
