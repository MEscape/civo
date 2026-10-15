import { EMPTY_PLAN, planFormOf } from './availability-plan-form';

import type { ResourceDto } from '../dto/setup-dto';
import type { AvailabilityPlanForm } from '../schemas/availability-plan-schema';

/** The value of "available at every location"; a real id is never this word. */
export const ANY_LOCATION = 'any';

/** What the resource form edits, in the shapes its inputs hold. */
export interface ResourceDraft {
  readonly name: string;
  readonly type: string;
  readonly locationId: string;
  readonly capacity: number | null;
  readonly skills: readonly string[];
  readonly isActive: boolean;
  readonly hasOwnHours: boolean;
  readonly availability: AvailabilityPlanForm;
}

function newResourceDraft(locationId: string): ResourceDraft {
  return {
    name: '',
    type: 'room',
    locationId,
    capacity: null,
    skills: [],
    isActive: true,
    hasOwnHours: false,
    availability: EMPTY_PLAN,
  };
}

function savedResourceDraft(resource: ResourceDto): ResourceDraft {
  return {
    name: resource.name,
    type: resource.type,
    locationId: resource.locationId ?? ANY_LOCATION,
    capacity: resource.capacity,
    skills: resource.skills,
    isActive: resource.isActive,
    hasOwnHours: resource.availability !== null,
    availability: planFormOf(resource.availability),
  };
}

/** The form's starting values: the saved resource, or a new active one at the place it is made. */
export function resourceDraftOf(
  resource: ResourceDto | undefined,
  locationId: string,
): ResourceDraft {
  return resource === undefined ? newResourceDraft(locationId) : savedResourceDraft(resource);
}

/** What is sent to the server action; the schema and the server validate it again. */
export function toResourceInput(
  websiteId: string,
  resourceId: string | undefined,
  draft: ResourceDraft,
) {
  return {
    websiteId,
    ...(resourceId === undefined ? {} : { id: resourceId }),
    locationId: draft.locationId === ANY_LOCATION ? null : draft.locationId,
    name: draft.name.trim(),
    type: draft.type,
    skills: draft.skills,
    capacity: draft.capacity,
    availability: draft.hasOwnHours ? draft.availability : null,
    isActive: draft.isActive,
  };
}
