import { meetsRequirement, offersService } from './resource-eligibility';
import { matchResources } from './resource-matching';

import type { ResourceDemand } from './resource-matching';
import type { BookableResource } from '../models/bookable-resource';
import type { BookableService } from '../models/bookable-service';
import type { BookingLocation } from '../models/booking-location';
import type { BookableResourceId, BookableServiceId, BookingLocationId } from '../models/ids';

/** The names listed per requirement are a preview, not a roster. */
export const FEASIBILITY_NAMES_SHOWN = 8;

/** What the check reads of a service: a saved one, or a draft that has no id yet. */
export interface FeasibilityService extends Pick<
  BookableService,
  'requirements' | 'capacity' | 'locationIds'
> {
  readonly id: BookableServiceId | null;
}

export interface FeasibilityInput {
  readonly service: FeasibilityService;
  /** The locations of the website; only those the service names are assessed. */
  readonly locations: readonly BookingLocation[];
  readonly resources: readonly BookableResource[];
}

/** How far the candidates narrow down, so a failure can say which condition removed the last one. */
export interface RequirementFunnel {
  readonly ofType: number;
  readonly withSkills: number;
  readonly atLocation: number;
  readonly inPool: number;
}

export interface RequirementCoverage {
  readonly requirementIndex: number;
  readonly resourceType: string;
  /** How many of them one appointment needs at the same time. */
  readonly needed: number;
  /** The resources that can fill it now, in website order. */
  readonly eligibleCount: number;
  readonly eligible: ReadonlyArray<{ readonly id: BookableResourceId; readonly name: string }>;
  readonly funnel: RequirementFunnel;
  /** Employees who fit but have not offered this service yet; they decide for themselves. */
  readonly awaitingEmployees: number;
}

/**
 * Why a location cannot serve the service:
 * - `not-enough-resources`: a requirement needs more resources than fit it;
 * - `shared-resources`: each requirement is met alone, but they compete for the same resources.
 */
export type FeasibilityBlock = 'not-enough-resources' | 'shared-resources';

export type LocationReadiness =
  /** Every requirement can be filled today. */
  | 'ready'
  /** Only employees who have not yet offered the service are missing; that is their choice, not a fault. */
  | 'awaiting-employees'
  /** A requirement cannot be filled by anything configured. */
  | 'blocked';

export interface LocationFeasibility {
  readonly locationId: BookingLocationId;
  readonly locationName: string;
  readonly readiness: LocationReadiness;
  readonly block: FeasibilityBlock | null;
  /** The first requirement that cannot be filled, when blocked for lack of resources. */
  readonly blockedRequirementIndex: number | null;
  readonly coverage: readonly RequirementCoverage[];
  /** The largest group one booking can bring that the resources can host; 0 when nothing is ready. */
  readonly largestGroup: number;
}

export interface ServiceFeasibility {
  readonly locations: readonly LocationFeasibility[];
  /** At least one location can take bookings or will once employees join. */
  readonly canBePublished: boolean;
}

function coverageOf(
  input: FeasibilityInput,
  location: BookingLocation,
): readonly RequirementCoverage[] {
  const { service, resources } = input;
  return service.requirements.map((requirement, requirementIndex) => {
    const ofType = resources.filter(
      (resource) => resource.isActive && resource.type === requirement.resourceType,
    );
    const withSkills = ofType.filter((resource) =>
      requirement.skills.every((skill) => resource.skills.includes(skill)),
    );
    const atLocation = withSkills.filter(
      (resource) => resource.locationId === null || resource.locationId === location.id,
    );
    const meets = resources.filter((resource) =>
      meetsRequirement(resource, requirement, location.id),
    );
    const eligible = meets.filter((resource) => offersService(resource, service.id));
    return {
      requirementIndex,
      resourceType: requirement.resourceType,
      needed: requirement.count,
      eligibleCount: eligible.length,
      eligible: eligible
        .slice(0, FEASIBILITY_NAMES_SHOWN)
        .map((resource) => ({ id: resource.id, name: resource.name })),
      funnel: {
        ofType: ofType.length,
        withSkills: withSkills.length,
        atLocation: atLocation.length,
        inPool: meets.length,
      },
      awaitingEmployees: meets.length - eligible.length,
    };
  });
}

/** How employees count when asking whether the requirements can be filled. */
type EmployeeRule =
  /** Only employees who offer the service fill a requirement. */
  | 'offered-only'
  /** Employee requirements are left out: employees may still join, so only the rest can block. */
  | 'left-out';

/** One question to the matcher: for which location, which group size, and how employees count. */
interface FillQuery {
  readonly location: BookingLocation;
  readonly group: number;
  readonly employees: EmployeeRule;
}

function demandsOf(input: FeasibilityInput, query: FillQuery): readonly ResourceDemand[] {
  const { location, group, employees } = query;
  return input.service.requirements.flatMap((requirement) => {
    if (employees === 'left-out' && requirement.resourceType === 'employee') {
      return [];
    }
    const candidates = input.resources
      .filter(
        (resource) =>
          meetsRequirement(resource, requirement, location.id) &&
          offersService(resource, input.service.id) &&
          // A resource too small for the group cannot host it.
          (resource.capacity === null || resource.capacity >= group),
      )
      .map((resource) => resource.id);
    return Array.from({ length: requirement.count }, () => ({ candidates }));
  });
}

function isFillable(input: FeasibilityInput, query: FillQuery): boolean {
  return matchResources(demandsOf(input, query)) !== null;
}

/** The biggest group (up to `limit`) for which the requirements can still be filled. */
function largestGroupOf(input: FeasibilityInput, location: BookingLocation, limit: number): number {
  if (!isFillable(input, { location, group: 1, employees: 'offered-only' })) {
    return 0;
  }
  let low = 1;
  let high = limit;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (isFillable(input, { location, group: middle, employees: 'offered-only' })) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

function assessLocation(input: FeasibilityInput, location: BookingLocation): LocationFeasibility {
  const coverage = coverageOf(input, location);
  const base = { locationId: location.id, locationName: location.name, coverage };

  if (isFillable(input, { location, group: 1, employees: 'offered-only' })) {
    return {
      ...base,
      readiness: 'ready',
      block: null,
      blockedRequirementIndex: null,
      largestGroup: largestGroupOf(input, location, input.service.capacity.participantsPerBooking),
    };
  }
  if (isFillable(input, { location, group: 1, employees: 'left-out' })) {
    return {
      ...base,
      readiness: 'awaiting-employees',
      block: null,
      blockedRequirementIndex: null,
      largestGroup: 0,
    };
  }
  const short = coverage.find(
    (entry) => entry.resourceType !== 'employee' && entry.funnel.inPool < entry.needed,
  );
  return {
    ...base,
    readiness: 'blocked',
    block: short === undefined ? 'shared-resources' : 'not-enough-resources',
    blockedRequirementIndex: short?.requirementIndex ?? null,
    largestGroup: 0,
  };
}

/**
 * Whether the resources that exist can fill what a service needs, location by
 * location, and if not, which requirement fails and why. It answers from the
 * same eligibility rule as the slot engine, so the preview and a real booking
 * cannot disagree about who qualifies. It does not look at opening hours or
 * bookings: that is the availability preview's job.
 *
 * A service that needs employees is not blocked by their absence: employees
 * choose which services they offer, so it waits for them (`awaiting-employees`).
 */
export function assessServiceFeasibility(input: FeasibilityInput): ServiceFeasibility {
  const named = new Set<string>(input.service.locationIds);
  const locations = input.locations
    .filter((location) => named.has(location.id))
    .map((location) => assessLocation(input, location));
  return {
    locations,
    canBePublished: locations.some((entry) => entry.readiness !== 'blocked'),
  };
}
